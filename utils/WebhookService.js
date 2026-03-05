const { useFirestore, getCollectionRef, setDoc, admin } = require("./db");

/**
 * WebhookService
 * Centralized logging and auditing for all incoming webhooks from external providers.
 */
class WebhookService {
    /**
     * Log an incoming webhook attempt
     * @param {string} provider - e.g., 'quickbooks', 'authorizenet'
     * @param {Object} payload - The raw request body
     * @param {Object} headers - The request headers
     * @param {string} tenantId - Optional tenant ID if identified early
     * @returns {Promise<string>} - The log ID
     */
    async logWebhook(provider, payload, headers, tenantId = null) {
        try {
            const logId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Clean sensitive headers
            const safeHeaders = { ...headers };
            delete safeHeaders['authorization'];
            delete safeHeaders['cookie'];
            delete safeHeaders['x-api-key'];

            const webhookLog = {
                id: logId,
                provider,
                payload,
                headers: safeHeaders,
                tenantId,
                status: 'received',
                receivedAt: new Date().toISOString(),
                processedAt: null,
                errorMessage: null
            };

            await setDoc('webhooks', logId, webhookLog);
            return logId;
        } catch (error) {
            console.error('[WebhookService] Failed to log webhook:', error);
            throw error;
        }
    }

    /**
     * Update the status of a logged webhook
     * @param {string} logId
     * @param {string} status - 'success', 'error', 'retrying'
     * @param {string} errorMessage
     */
    async updateStatus(logId, status, errorMessage = null) {
        try {
            const updates = {
                status,
                processedAt: new Date().toISOString(),
                errorMessage
            };

            await admin.firestore().collection('webhooks').doc(logId).update(updates);
        } catch (error) {
            console.error('[WebhookService] Failed to update status:', error);
        }
    }

    /**
     * Get recent webhooks for the platform explorer
     * @param {number} limit
     */
    async getRecentWebhooks(limit = 50) {
        try {
            const snap = await admin.firestore()
                .collection('webhooks')
                .orderBy('receivedAt', 'desc')
                .limit(limit)
                .get();

            const logs = [];
            snap.forEach(doc => logs.push(doc.data()));
            return logs;
        } catch (error) {
            console.error('[WebhookService] Failed to fetch logs:', error);
            return [];
        }
    }
}

module.exports = new WebhookService();
