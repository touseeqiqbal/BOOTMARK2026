/**
 * Enhanced Audit Service
 * 
 * Append-only, immutable audit logs with structured diffs.
 * All writes are tenant-scoped via businessId.
 * Logs can never be updated or deleted (enforced by Firestore rules).
 * 
 * Schema per log entry:
 *   eventType    - e.g. 'invoice.created', 'workOrder.statusChanged'
 *   actorId      - UID of the user who performed the action
 *   actorRole    - Role at the time of the action
 *   actorName    - Display name (denormalized for readability)
 *   entityType   - 'invoice', 'workOrder', 'client', etc.
 *   entityId     - Document ID
 *   businessId   - Tenant/business ID
 *   diff         - { field: { old, new } }
 *   metadata     - Additional context
 *   timestamp    - Server timestamp
 *   ip           - Request IP (if available)
 *   userAgent    - Request user-agent (if available)
 * 
 * Usage:
 *   const audit = require('./EnhancedAuditService');
 *   await audit.log(req, 'invoice.created', 'invoice', invoiceId, { status: { old: null, new: 'draft' } }, { total: 500 });
 */

const { db } = require('./db');
const admin = require('firebase-admin');

class EnhancedAuditService {

    /**
     * Write an audit log entry (append-only)
     * 
     * @param {Object} req - Express request (for actor context)
     * @param {string} eventType - Event identifier (e.g. 'invoice.created')
     * @param {string} entityType - Entity type (e.g. 'invoice')
     * @param {string} entityId - Entity document ID
     * @param {Object} diff - Changes: { field: { old, new } }
     * @param {Object} metadata - Additional context data
     * @returns {string} Audit log document ID
     */
    async log(req, eventType, entityType, entityId, diff = {}, metadata = {}) {
        try {
            const businessId = req.tenantId || req.user?.businessId || req.businessId;
            const actorId = req.user?.uid || req.user?.id || 'system';
            const actorRole = req.user?.effectiveRole || req.user?.businessRole || req.user?.role || 'unknown';
            const actorName = req.user?.name || req.user?.email || 'Unknown';

            const logEntry = {
                eventType,
                actorId,
                actorRole,
                actorName,
                entityType,
                entityId,
                businessId: businessId || null,
                diff: this.sanitizeDiff(diff),
                metadata: this.sanitizeMetadata(metadata),
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                ip: req.ip || req.connection?.remoteAddress || null,
                userAgent: req.headers?.['user-agent']?.substring(0, 200) || null,
            };

            const collection = businessId ? 'auditLogs' : 'platformAuditLogs';
            const docRef = await db.collection(collection).add(logEntry);

            return docRef.id;
        } catch (error) {
            // Audit logging should never crash the request
            console.error('[Audit] Failed to write audit log:', error.message);
            return null;
        }
    }

    /**
     * Log a platform-level event (super admin actions, global events)
     * 
     * @param {string} eventType
     * @param {string} actorId
     * @param {Object} data - { entityType, entityId, diff, metadata }
     */
    async logPlatformEvent(eventType, actorId, data = {}) {
        try {
            await db.collection('platformAuditLogs').add({
                eventType,
                actorId,
                actorRole: 'super_admin',
                entityType: data.entityType || null,
                entityId: data.entityId || null,
                businessId: data.businessId || null,
                diff: data.diff || {},
                metadata: data.metadata || {},
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        } catch (error) {
            console.error('[Audit] Failed to write platform audit log:', error.message);
        }
    }

    /**
     * Compute a diff between two objects
     * 
     * @param {Object} before - Previous state
     * @param {Object} after - New state
     * @param {string[]} fieldsToTrack - Only track these fields (optional)
     * @returns {Object} { field: { old, new } }
     */
    computeDiff(before, after, fieldsToTrack = null) {
        const diff = {};
        const fields = fieldsToTrack || new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

        for (const field of fields) {
            const oldVal = before?.[field];
            const newVal = after?.[field];

            // Skip internal fields
            if (field.startsWith('_') || field === 'updatedAt' || field === 'createdAt') continue;

            // Compare values
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                diff[field] = {
                    old: this.truncateValue(oldVal),
                    new: this.truncateValue(newVal)
                };
            }
        }

        return diff;
    }

    /**
     * Query audit logs for an entity
     * 
     * @param {string} businessId
     * @param {string} entityType
     * @param {string} entityId
     * @param {number} limit
     * @returns {Array} Audit log entries
     */
    async getEntityHistory(businessId, entityType, entityId, limit = 50) {
        try {
            const snap = await db.collection('auditLogs')
                .where('businessId', '==', businessId)
                .where('entityType', '==', entityType)
                .where('entityId', '==', entityId)
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('[Audit] Failed to get entity history:', error.message);
            return [];
        }
    }

    /**
     * Query recent audit logs for a business
     * 
     * @param {string} businessId
     * @param {Object} options - { eventType, limit, startAfter }
     * @returns {Array}
     */
    async getBusinessLogs(businessId, { eventType = null, limit = 100, startAfter = null } = {}) {
        try {
            let query = db.collection('auditLogs')
                .where('businessId', '==', businessId)
                .orderBy('timestamp', 'desc')
                .limit(limit);

            if (eventType) {
                query = query.where('eventType', '==', eventType);
            }

            if (startAfter) {
                query = query.startAfter(startAfter);
            }

            const snap = await query.get();
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('[Audit] Failed to get business logs:', error.message);
            return [];
        }
    }

    /**
     * Export old audit logs (for archival/BigQuery)
     * Returns logs older than the given date
     * 
     * @param {string} businessId
     * @param {Date} olderThan
     * @param {number} batchSize
     * @returns {Array}
     */
    async getLogsForArchival(businessId, olderThan, batchSize = 500) {
        try {
            const snap = await db.collection('auditLogs')
                .where('businessId', '==', businessId)
                .where('timestamp', '<', olderThan)
                .orderBy('timestamp', 'asc')
                .limit(batchSize)
                .get();

            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('[Audit] Failed to get logs for archival:', error.message);
            return [];
        }
    }

    // ─── Private Helpers ────────────────────────────────────

    sanitizeDiff(diff) {
        if (!diff || typeof diff !== 'object') return {};
        const cleaned = {};
        for (const [key, value] of Object.entries(diff)) {
            // Don't log sensitive fields
            if (['password', 'secret', 'token', 'accessToken', 'refreshToken', 'transactionKey'].includes(key)) {
                cleaned[key] = { old: '[REDACTED]', new: '[REDACTED]' };
            } else {
                cleaned[key] = value;
            }
        }
        return cleaned;
    }

    sanitizeMetadata(metadata) {
        if (!metadata || typeof metadata !== 'object') return {};
        const cleaned = {};
        for (const [key, value] of Object.entries(metadata)) {
            if (typeof value === 'function' || typeof value === 'symbol') continue;
            cleaned[key] = this.truncateValue(value);
        }
        return cleaned;
    }

    truncateValue(value) {
        if (value === undefined || value === null) return value;
        if (typeof value === 'string' && value.length > 500) {
            return value.substring(0, 500) + '...[truncated]';
        }
        if (Array.isArray(value) && value.length > 20) {
            return [...value.slice(0, 20), `...(${value.length} total)`];
        }
        return value;
    }
}

module.exports = new EnhancedAuditService();
