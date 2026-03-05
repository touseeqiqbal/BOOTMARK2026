const { admin, getDoc, setDoc, getCollectionRef } = require('./db');
const otplib = require('otplib');
const qrcode = require('qrcode');

class PlatformService {
    /**
     * Enforce the limit of 2 super admins
     * @returns {Promise<boolean>} True if another admin can be added
     */
    async canAddSuperAdmin() {
        const configSnap = await admin.firestore().collection('platform').doc('config').get();
        const allowedAdmins = configSnap.exists ? (configSnap.data().allowedAdmins || []) : [];

        // Also verify against the actual users collection for consistency
        const usersSnap = await admin.firestore().collection('users')
            .where('isSuperAdmin', '==', true)
            .get();

        return usersSnap.size < 2;
    }

    /**
     * Log a sensitive platform-level action
     */
    async logAction(adminId, action, targetTenantId, details = {}) {
        const logRef = admin.firestore().collection('platformAuditLogs').doc();
        const adminDoc = await getDoc('users', adminId);

        await logRef.set({
            id: logRef.id,
            action,
            adminId,
            adminEmail: adminDoc?.email || 'unknown',
            targetTenantId,
            details,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            ip: details.ip || 'internal'
        });
    }

    /**
     * Generate MFA Secret and QR Code for a super admin
     */
    async setupMFA(userId) {
        const secret = otplib.authenticator.generateSecret();
        const userDoc = await getDoc('users', userId);
        const otpauth = otplib.authenticator.keyuri(userDoc.email, 'BOOTMARK-ADMIN', secret);
        const qrCodeUrl = await qrcode.toDataURL(otpauth);

        // Store secret securely (backend-only access)
        await admin.firestore().collection('mfaSecrets').doc(userId).set({
            secret,
            createdAt: new Date().toISOString()
        });

        return { qrCodeUrl, secret };
    }

    /**
     * Verify TOTP code
     */
    async verifyMFA(userId, token) {
        const mfaSnap = await admin.firestore().collection('mfaSecrets').doc(userId).get();
        if (!mfaSnap.exists) return false;

        const { secret } = mfaSnap.data();
        return otplib.authenticator.check(token, secret);
    }

    /**
     * Update tenant status with enforcement
     */
    async updateTenantStatus(adminId, tenantId, status, reason = '') {
        const businessRef = admin.firestore().collection('businesses').doc(tenantId);
        const businessSnap = await businessRef.get();

        if (!businessSnap.exists) throw new Error('Tenant not found');

        const oldStatus = businessSnap.data().status;

        await businessRef.update({
            status,
            updatedAt: new Date().toISOString(),
            statusUpdatedAt: new Date().toISOString(),
            statusUpdatedBy: adminId,
            suspensionReason: reason
        });

        await this.logAction(adminId, 'TENANT_STATUS_CHANGE', tenantId, {
            oldStatus,
            newStatus: status,
            reason
        });

        return { success: true };
    }

    /**
     * Get platform-wide metrics including MRR
     */
    async getPlatformMetrics() {
        const businesses = await getCollectionRef('businesses').get();
        const users = await getCollectionRef('users').get();

        const stats = {
            totalTenants: businesses.size,
            activeTenants: 0,
            pendingTenants: 0,
            suspendedTenants: 0,
            totalUsers: users.size,
            mrr: 0,
            planDistribution: {}
        };

        businesses.forEach(doc => {
            const data = doc.data();
            const status = data.status || 'inactive';

            // Status counts
            if (status === 'active') stats.activeTenants++;
            else if (status === 'pending-review') stats.pendingTenants++;
            else if (status === 'suspended') stats.suspendedTenants++;

            // MRR & Plan Stats
            if (status === 'active' && data.planId) {
                const price = parseFloat(data.planPrice) || 0;
                stats.mrr += price;

                const planName = data.planName || 'Unknown';
                stats.planDistribution[planName] = (stats.planDistribution[planName] || 0) + 1;
            }
        });

        // Round MRR to 2 decimal places
        stats.mrr = Math.round(stats.mrr * 100) / 100;

        return stats;
    }

    /**
     * Get platform audit logs
     */
    async getAuditLogs(limit = 50) {
        try {
            const snap = await admin.firestore()
                .collection('platformAuditLogs')
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            const logs = [];
            snap.forEach(doc => {
                const data = doc.data();
                logs.push({
                    ...data,
                    timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp
                });
            });
            return logs;
        } catch (error) {
            console.error('[PlatformService] Failed to fetch audit logs:', error);
            return [];
        }
    }

    /**
     * Get platform-wide billing transactions
     */
    async getBillingTransactions(limit = 100) {
        try {
            const snap = await admin.firestore()
                .collection('paymentAttempts')
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();

            const txs = [];
            snap.forEach(doc => txs.push({ id: doc.id, ...doc.data() }));
            return txs;
        } catch (error) {
            console.error('[PlatformService] Failed to fetch billing transactions:', error);
            return [];
        }
    }

    /**
     * Get system-wide alerts
     */
    async getSystemAlerts() {
        try {
            // Placeholder: In a real app, this might query for failed webhooks, 
            // high volume errors, or billing failures in the last 24h.
            const alerts = [];

            // 1. Check for failed webhooks
            const failedWebhooks = await admin.firestore()
                .collection('webhooks')
                .where('status', '==', 'error')
                .orderBy('receivedAt', 'desc')
                .limit(5)
                .get();

            failedWebhooks.forEach(doc => {
                const data = doc.data();
                alerts.push({
                    id: doc.id,
                    type: 'error',
                    title: `Webhook Failure: ${data.provider}`,
                    message: data.errorMessage,
                    timestamp: data.receivedAt,
                    link: `/admin/webhooks`
                });
            });

            // 2. Check for recent payment failures
            const failedPayments = await admin.firestore()
                .collection('paymentAttempts')
                .where('status', '==', 'failed')
                .orderBy('failedAt', 'desc')
                .limit(5)
                .get();

            failedPayments.forEach(doc => {
                const data = doc.data();
                alerts.push({
                    id: doc.id,
                    type: 'warning',
                    title: 'Payment Failed',
                    message: `Transaction failed: ${data.error}`,
                    timestamp: data.failedAt,
                    link: `/admin/billing`
                });
            });

            return alerts;
        } catch (error) {
            console.error('[PlatformService] Failed to fetch alerts:', error);
            return [];
        }
    }
}

module.exports = new PlatformService();
