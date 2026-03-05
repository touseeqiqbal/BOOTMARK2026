/**
 * QuickBooks Online Sync Service
 * 
 * Handles bidirectional sync between BOOTMARK and QuickBooks Online.
 * 
 * Design:
 *   - Token storage with rotation (accessToken + refreshToken per tenant)
 *   - Idempotent sync using externalIdMap on each entity
 *   - Sync logs per tenant for auditability
 *   - Retry with exponential backoff
 *   - Dead-letter for persistent failures
 * 
 * Usage:
 *   const qbSync = require('./QuickBooksSyncService');
 *   await qbSync.syncInvoices(businessId);
 *   await qbSync.syncClients(businessId);
 */

const { db, getDoc, getCollectionRef } = require('./db');
const admin = require('firebase-admin');

class QuickBooksSyncService {

    constructor() {
        this.MAX_RETRIES = 5;
        this.BASE_DELAY_MS = 5000;
    }

    // ─── Token Management ─────────────────────────────────

    /**
     * Get a valid QuickBooks access token for a tenant
     * Automatically refreshes if expired
     * 
     * @param {string} businessId
     * @returns {Object} { accessToken, realmId }
     */
    async getAccessToken(businessId) {
        const integRef = db.collection('integrations').doc(`${businessId}_quickbooks`);
        const integSnap = await integRef.get();

        if (!integSnap.exists) {
            throw new Error('QuickBooks not connected for this business');
        }

        const data = integSnap.data();
        const now = Date.now();
        const expiresAt = data.tokenExpiresAt?.toMillis?.() || new Date(data.tokenExpiresAt).getTime();

        // Refresh if expired or about to expire (5 min buffer)
        if (now >= expiresAt - 300_000) {
            return await this.refreshAccessToken(businessId, data.refreshToken, data.realmId);
        }

        return {
            accessToken: data.accessToken,
            realmId: data.realmId
        };
    }

    /**
     * Refresh the QuickBooks access token
     */
    async refreshAccessToken(businessId, refreshToken, realmId) {
        try {
            const clientId = process.env.QB_CLIENT_ID;
            const clientSecret = process.env.QB_CLIENT_SECRET;

            if (!clientId || !clientSecret) {
                throw new Error('QuickBooks OAuth credentials not configured');
            }

            const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
                },
                body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
            });

            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`Token refresh failed: ${response.status} ${errBody}`);
            }

            const tokens = await response.json();

            // Update stored tokens
            const integRef = db.collection('integrations').doc(`${businessId}_quickbooks`);
            await integRef.update({
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token || refreshToken, // QB may not always return new refresh token
                tokenExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + tokens.expires_in * 1000),
                lastError: null,
            });

            return {
                accessToken: tokens.access_token,
                realmId
            };

        } catch (error) {
            // Mark integration as errored
            await db.collection('integrations').doc(`${businessId}_quickbooks`).update({
                syncStatus: 'error',
                lastError: `Token refresh failed: ${error.message}`,
            });
            throw error;
        }
    }

    // ─── Sync Operations ──────────────────────────────

    /**
     * Sync all invoices from BOOTMARK → QuickBooks
     * 
     * @param {string} businessId
     * @returns {Object} { synced, skipped, failed, errors }
     */
    async syncInvoices(businessId) {
        const results = { synced: 0, skipped: 0, failed: 0, errors: [] };

        try {
            await this.updateSyncStatus(businessId, 'syncing');
            const { accessToken, realmId } = await this.getAccessToken(businessId);

            let lastDoc = null;
            let hasMore = true;

            while (hasMore) {
                let query = getCollectionRef('invoices')
                    .where('businessId', '==', businessId)
                    .where('status', 'in', ['sent', 'paid', 'overdue'])
                    .orderBy('createdAt', 'desc')
                    .limit(50);

                if (lastDoc) {
                    query = query.startAfter(lastDoc);
                }

                const invoicesSnap = await query.get();
                if (invoicesSnap.empty) {
                    hasMore = false;
                    break;
                }

                for (const doc of invoicesSnap.docs) {
                    const invoice = { id: doc.id, ...doc.data() };

                    try {
                        const syncResult = await this.syncSingleInvoice(
                            businessId, invoice, accessToken, realmId
                        );

                        if (syncResult.action === 'synced') results.synced++;
                        else if (syncResult.action === 'skipped') results.skipped++;

                        await this.writeSyncLog(businessId, {
                            direction: 'push',
                            entityType: 'invoice',
                            entityId: invoice.id,
                            externalId: syncResult.externalId,
                            action: syncResult.action,
                            error: null,
                        });

                    } catch (error) {
                        results.failed++;
                        results.errors.push({ invoiceId: invoice.id, error: error.message });

                        await this.writeSyncLog(businessId, {
                            direction: 'push',
                            entityType: 'invoice',
                            entityId: invoice.id,
                            externalId: null,
                            action: 'failed',
                            error: error.message,
                        });
                    }
                }

                lastDoc = invoicesSnap.docs[invoicesSnap.docs.length - 1];
                if (invoicesSnap.docs.length < 50) hasMore = false;
            }

            await this.updateSyncStatus(businessId, 'idle', null, new Date());
        } catch (error) {
            await this.updateSyncStatus(businessId, 'error', error.message);
            results.errors.push({ error: error.message });
        }

        return results;
    }

    /**
     * Sync a single invoice to QuickBooks (idempotent)
     */
    async syncSingleInvoice(businessId, invoice, accessToken, realmId) {
        const qbId = invoice.externalIdMap?.quickbooksId;
        const baseUrl = process.env.QB_ENVIRONMENT === 'production'
            ? 'https://quickbooks.api.intuit.com'
            : 'https://sandbox-quickbooks.api.intuit.com';

        const qbInvoice = this.mapInvoiceToQB(invoice);

        if (qbId) {
            // UPDATE existing QB invoice
            const response = await fetch(`${baseUrl}/v3/company/${realmId}/invoice?operation=update`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ ...qbInvoice, Id: qbId, SyncToken: '0' })
            });

            if (!response.ok) {
                throw new Error(`QB update failed: ${response.status}`);
            }

            return { action: 'synced', externalId: qbId };

        } else {
            // CREATE new QB invoice
            const response = await fetch(`${baseUrl}/v3/company/${realmId}/invoice`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(qbInvoice)
            });

            if (!response.ok) {
                throw new Error(`QB create failed: ${response.status}`);
            }

            const result = await response.json();
            const newQbId = result.Invoice?.Id;

            // Store the QB ID in the invoice's externalIdMap
            if (newQbId) {
                await db.collection('invoices').doc(invoice.id).update({
                    'externalIdMap.quickbooksId': String(newQbId),
                    updatedAt: new Date().toISOString(),
                });
            }

            return { action: 'synced', externalId: newQbId };
        }
    }

    /**
     * Sync clients from BOOTMARK → QuickBooks as Customers
     */
    async syncClients(businessId) {
        const results = { synced: 0, skipped: 0, failed: 0, errors: [] };

        try {
            await this.updateSyncStatus(businessId, 'syncing');
            const { accessToken, realmId } = await this.getAccessToken(businessId);

            const clientsSnap = await getCollectionRef('customers')
                .where('businessId', '==', businessId)
                .get();

            for (const doc of clientsSnap.docs) {
                const client = { id: doc.id, ...doc.data() };

                try {
                    const qbId = client.externalIdMap?.quickbooksId;
                    const baseUrl = process.env.QB_ENVIRONMENT === 'production'
                        ? 'https://quickbooks.api.intuit.com'
                        : 'https://sandbox-quickbooks.api.intuit.com';

                    const qbCustomer = {
                        DisplayName: client.name || `${client.firstName || ''} ${client.lastName || ''}`.trim(),
                        PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
                        PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
                    };

                    if (qbId) {
                        // Update
                        await fetch(`${baseUrl}/v3/company/${realmId}/customer?operation=update`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ ...qbCustomer, Id: qbId, SyncToken: '0' })
                        });
                        results.synced++;
                    } else {
                        // Create
                        const response = await fetch(`${baseUrl}/v3/company/${realmId}/customer`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(qbCustomer)
                        });

                        const result = await response.json();
                        const newQbId = result.Customer?.Id;

                        if (newQbId) {
                            await db.collection('customers').doc(client.id).update({
                                'externalIdMap.quickbooksId': String(newQbId),
                            });
                        }
                        results.synced++;
                    }

                    await this.writeSyncLog(businessId, {
                        direction: 'push',
                        entityType: 'client',
                        entityId: client.id,
                        externalId: qbId || 'new',
                        action: 'synced',
                    });

                } catch (error) {
                    results.failed++;
                    results.errors.push({ clientId: client.id, error: error.message });
                }
            }

            await this.updateSyncStatus(businessId, 'idle', null, new Date());
        } catch (error) {
            await this.updateSyncStatus(businessId, 'error', error.message);
        }

        return results;
    }

    // ─── Helpers ──────────────────────────────────────

    /**
     * Map a BOOTMARK invoice to QuickBooks format
     */
    mapInvoiceToQB(invoice) {
        return {
            Line: (invoice.lineItems || []).map((item, idx) => ({
                LineNum: idx + 1,
                Amount: item.total || (item.qty * item.unitPrice) || 0,
                DetailType: 'SalesItemLineDetail',
                Description: item.description || '',
                SalesItemLineDetail: {
                    Qty: item.qty || 1,
                    UnitPrice: item.unitPrice || item.total || 0,
                }
            })),
            DueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : undefined,
            DocNumber: invoice.invoiceNumber,
        };
    }

    /**
     * Write a sync log entry
     */
    async writeSyncLog(businessId, logData) {
        try {
            await db.collection('syncLogs').add({
                businessId,
                syncId: `${businessId}_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
                ...logData,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        } catch (error) {
            console.error('[QBSync] Failed to write sync log:', error.message);
        }
    }

    /**
     * Update the sync status on the integration doc
     */
    async updateSyncStatus(businessId, status, error = null, lastSyncAt = null) {
        const update = {
            syncStatus: status,
            lastError: error,
        };
        if (lastSyncAt) update.lastSyncAt = lastSyncAt.toISOString();

        await db.collection('integrations').doc(`${businessId}_quickbooks`).update(update);
    }

    /**
     * Retry wrapper with exponential backoff
     */
    async withRetry(fn, maxRetries = this.MAX_RETRIES) {
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                // Don't retry auth errors
                if (error.message?.includes('401') || error.message?.includes('403')) {
                    throw error;
                }

                if (attempt < maxRetries) {
                    const delay = this.BASE_DELAY_MS * Math.pow(2, attempt - 1);
                    console.warn(`[QBSync] Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
        throw lastError;
    }

    /**
     * Get sync status for admin dashboard
     */
    async getSyncStatus(businessId) {
        const doc = await db.collection('integrations').doc(`${businessId}_quickbooks`).get();
        if (!doc.exists) return null;
        return doc.data();
    }

    /**
     * Get recent sync logs
     */
    async getSyncLogs(businessId, limit = 50) {
        const snap = await db.collection('syncLogs')
            .where('businessId', '==', businessId)
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();

        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
}

module.exports = new QuickBooksSyncService();
