/**
 * Metrics Service
 * 
 * Pre-aggregated metrics for O(1) dashboard reads.
 * Instead of scanning entire collections, we maintain counter docs
 * that are updated incrementally when data changes.
 * 
 * Metrics are stored in a `metrics` collection per business:
 *   /metrics/{businessId}_{metricKey}
 * 
 * Usage:
 *   const metrics = require('./MetricsService');
 *   await metrics.incrementCounter(businessId, 'invoice_count', 1);
 *   await metrics.updateRevenueMetric(businessId, month, amount, 'paid');
 *   const dashboard = await metrics.getDashboardMetrics(businessId);
 */

const { db, getCollectionRef } = require('./db');
const admin = require('firebase-admin');

class MetricsService {

    /**
     * Get the metrics document reference for a business
     * @param {string} businessId
     * @param {string} metricKey
     * @returns {FirebaseFirestore.DocumentReference}
     */
    getMetricRef(businessId, metricKey) {
        return db.collection('metrics').doc(`${businessId}_${metricKey}`);
    }

    /**
     * Increment a simple counter metric
     * @param {string} businessId
     * @param {string} metricKey - e.g. 'invoice_count', 'work_order_count'
     * @param {number} delta - Amount to increment (use negative to decrement)
     */
    async incrementCounter(businessId, metricKey, delta = 1) {
        try {
            const ref = this.getMetricRef(businessId, metricKey);
            await ref.set({
                businessId,
                key: metricKey,
                value: admin.firestore.FieldValue.increment(delta),
                lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error(`[Metrics] Failed to increment ${metricKey}:`, error.message);
        }
    }

    /**
     * Update revenue metrics for a specific month
     * @param {string} businessId
     * @param {string} month - Format: "2026-02"
     * @param {number} amount
     * @param {string} action - 'created', 'paid', 'voided', 'deleted'
     */
    async updateRevenueMetric(businessId, month, amount, action) {
        try {
            const ref = this.getMetricRef(businessId, 'revenue_monthly');

            await db.runTransaction(async (txn) => {
                const snap = await txn.get(ref);
                const data = snap.exists ? snap.data().data || {} : {};
                const current = data[month] || { total: 0, paid: 0, pending: 0, count: 0 };

                switch (action) {
                    case 'created':
                        current.total += amount;
                        current.pending += amount;
                        current.count += 1;
                        break;
                    case 'paid':
                        current.paid += amount;
                        current.pending -= amount;
                        break;
                    case 'voided':
                    case 'deleted':
                        current.total -= amount;
                        current.count -= 1;
                        current.pending -= amount;
                        break;
                    case 'refunded':
                        current.paid -= amount;
                        break;
                }

                // Ensure no negative values
                current.total = Math.max(0, current.total);
                current.paid = Math.max(0, current.paid);
                current.pending = Math.max(0, current.pending);
                current.count = Math.max(0, current.count);

                data[month] = current;

                txn.set(ref, {
                    businessId,
                    key: 'revenue_monthly',
                    data,
                    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
        } catch (error) {
            console.error(`[Metrics] Failed to update revenue metric:`, error.message);
        }
    }

    /**
     * Update work order status summary
     * @param {string} businessId
     * @param {string} oldStatus - Previous status (null for new)
     * @param {string} newStatus - New status (null for deleted)
     */
    async updateWorkOrderSummary(businessId, oldStatus, newStatus) {
        try {
            const ref = this.getMetricRef(businessId, 'work_order_summary');

            await db.runTransaction(async (txn) => {
                const snap = await txn.get(ref);
                const data = snap.exists ? snap.data().data || {} : {
                    draft: 0, scheduled: 0, in_progress: 0, completed: 0, cancelled: 0
                };

                if (oldStatus && data[oldStatus] !== undefined) {
                    data[oldStatus] = Math.max(0, (data[oldStatus] || 0) - 1);
                }
                if (newStatus && data[newStatus] !== undefined) {
                    data[newStatus] = (data[newStatus] || 0) + 1;
                }

                txn.set(ref, {
                    businessId,
                    key: 'work_order_summary',
                    data,
                    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
        } catch (error) {
            console.error(`[Metrics] Failed to update work order summary:`, error.message);
        }
    }

    /**
     * Update overdue invoices metric
     * @param {string} businessId
     */
    async recalculateOverdueInvoices(businessId) {
        try {
            const now = new Date();
            const invoicesRef = getCollectionRef('invoices');
            const overdueSnap = await invoicesRef
                .where('businessId', '==', businessId)
                .where('status', 'in', ['sent', 'overdue'])
                .where('dueDate', '<', now.toISOString())
                .get();

            let count = 0;
            let totalAmount = 0;
            let oldestDueDate = null;

            overdueSnap.forEach(doc => {
                const data = doc.data();
                count++;
                totalAmount += (data.total || 0) - (data.amountPaid || 0);
                const dueDate = data.dueDate;
                if (!oldestDueDate || dueDate < oldestDueDate) {
                    oldestDueDate = dueDate;
                }
            });

            const ref = this.getMetricRef(businessId, 'overdue_invoices');
            await ref.set({
                businessId,
                key: 'overdue_invoices',
                data: { count, totalAmount, oldestDueDate },
                lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

        } catch (error) {
            console.error(`[Metrics] Failed to recalculate overdue invoices:`, error.message);
        }
    }

    /**
     * Update client count metric
     * @param {string} businessId
     * @param {number} delta
     */
    async updateClientCount(businessId, delta = 1) {
        await this.incrementCounter(businessId, 'client_count', delta);
    }

    /**
     * Get all dashboard metrics in one call (O(1) reads per metric)
     * @param {string} businessId
     * @returns {Object} Dashboard metrics
     */
    async getDashboardMetrics(businessId) {
        try {
            const metricKeys = [
                'revenue_monthly',
                'work_order_summary',
                'overdue_invoices',
                'invoice_count',
                'client_count',
                'work_order_count'
            ];

            const refs = metricKeys.map(key => this.getMetricRef(businessId, key));
            const snapshots = await db.getAll(...refs);

            const result = {};
            snapshots.forEach((snap, idx) => {
                if (snap.exists) {
                    const data = snap.data();
                    result[metricKeys[idx]] = data.data !== undefined ? data.data : data.value;
                } else {
                    result[metricKeys[idx]] = metricKeys[idx].includes('monthly') || metricKeys[idx].includes('summary')
                        ? {}
                        : 0;
                }
            });

            return result;
        } catch (error) {
            console.error(`[Metrics] Failed to get dashboard metrics:`, error.message);
            return {};
        }
    }

    /**
     * Initialize metrics for a new business
     * @param {string} businessId
     */
    async initializeBusinessMetrics(businessId) {
        const batch = db.batch();
        const now = admin.firestore.FieldValue.serverTimestamp();

        const defaults = {
            revenue_monthly: { data: {} },
            work_order_summary: { data: { draft: 0, scheduled: 0, in_progress: 0, completed: 0, cancelled: 0 } },
            overdue_invoices: { data: { count: 0, totalAmount: 0, oldestDueDate: null } },
            invoice_count: { value: 0 },
            client_count: { value: 0 },
            work_order_count: { value: 0 }
        };

        for (const [key, defaultData] of Object.entries(defaults)) {
            const ref = this.getMetricRef(businessId, key);
            batch.set(ref, {
                businessId,
                key,
                ...defaultData,
                lastUpdatedAt: now
            }, { merge: true });
        }

        await batch.commit();
        console.log(`[Metrics] Initialized metrics for business ${businessId}`);
    }
}

module.exports = new MetricsService();
