const { db } = require('./db');
const { v4: uuidv4 } = require('uuid');

class AuditService {
    async logEvent({ userId, userEmail, action, resource, resourceId, metadata = {}, businessId = null }) {
        if (!db) {
            console.warn('AuditLog: Firestore not available, skipping log.');
            return;
        }

        try {
            const auditRef = db.collection('audit_logs').doc(uuidv4());
            const logEntry = {
                userId,
                userEmail,
                action, // 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', etc.
                resource, // 'INVOICE', 'ESTIMATE', 'CUSTOMER', etc.
                resourceId,
                metadata, // Any additional context (e.g., changes, IP address)
                businessId,
                timestamp: new Date().toISOString()
            };

            await auditRef.set(logEntry);
            return logEntry;
        } catch (error) {
            console.error('Failed to save audit log:', error);
        }
    }

    async getLogs(filters = {}, limit = 50, offset = 0) {
        if (!db) return [];

        try {
            let query = db.collection('audit_logs');

            // Apply filters first
            if (filters.businessId) {
                query = query.where('businessId', '==', filters.businessId);
            }
            if (filters.userId) {
                query = query.where('userId', '==', filters.userId);
            }
            if (filters.resource) {
                query = query.where('resource', '==', filters.resource);
            }
            if (filters.action) {
                query = query.where('action', '==', filters.action);
            }

            // Apply ordering last
            query = query.orderBy('timestamp', 'desc');

            const snapshot = await query.limit(limit).offset(offset).get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
            return [];
        }
    }
}

module.exports = new AuditService();
