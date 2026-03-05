const express = require("express");
const router = express.Router();

const { getCollectionRef } = require("../utils/db");
const auth = require("../middleware/auth");
const { authRequired, twoFactorRequired } = auth;
const { authorize } = require("../middleware/authorize");
const metricsService = require("../utils/MetricsService");

// Dashboard Summary Stats
router.get("/dashboard-stats", authRequired, authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user.businessId;
        if (!businessId) {
            return res.status(400).json({ error: "Business context required" });
        }

        // Initialize response object
        const responseData = {
            totalCustomers: 0,
            totalWorkOrders: 0,
            totalServices: 0,
            totalContracts: 0,
            recentWorkOrders: [],
            upcomingJobs: []
        };

        // Try pre-aggregated metrics first (O(1) reads)
        let usedPreAggregated = false;
        try {
            const preAgg = await metricsService.getDashboardMetrics(businessId);
            if (preAgg && Object.keys(preAgg).length > 0) {
                responseData.totalCustomers = preAgg.client_count || 0;
                responseData.totalWorkOrders = preAgg.work_order_count || 0;
                responseData.workOrderSummary = preAgg.work_order_summary || {};
                responseData.overdueInvoices = preAgg.overdue_invoices || {};
                usedPreAggregated = true;
            }
        } catch (e) {
            // Fall through to legacy count queries
        }

        // Fallback: Fetch Counts via collection scans
        if (!usedPreAggregated) {
            try {
                const [
                    customersSnap,
                    workOrdersSnap,
                    servicesSnap,
                    contractsSnap
                ] = await Promise.all([
                    getCollectionRef('customers').where('businessId', '==', businessId).count().get(),
                    getCollectionRef('workOrders').where('businessId', '==', businessId).count().get(),
                    getCollectionRef('services').where('businessId', '==', businessId).count().get(),
                    getCollectionRef('contracts').where('businessId', '==', businessId).count().get()
                ]);

                responseData.totalCustomers = customersSnap.data().count;
                responseData.totalWorkOrders = workOrdersSnap.data().count;
                responseData.totalServices = servicesSnap.data().count;
                responseData.totalContracts = contractsSnap.data().count;
            } catch (error) {
                console.error("Error fetching dashboard counts:", error);
            }
        }

        // Fetch Recent Work Orders (always live)
        try {
            const recentWOSnap = await getCollectionRef('workOrders')
                .where('businessId', '==', businessId)
                .orderBy('createdAt', 'desc')
                .limit(5)
                .get();

            recentWOSnap.forEach(doc => responseData.recentWorkOrders.push({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error fetching recent work orders:", error);
        }

        // Fetch Upcoming Jobs (always live)
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const upcomingJobsSnap = await getCollectionRef('workOrders')
                .where('businessId', '==', businessId)
                .limit(100)
                .get();

            const jobs = [];
            upcomingJobsSnap.forEach(doc => {
                const data = doc.data();
                if (data.status !== 'completed' && data.status !== 'cancelled' && data.scheduledDate) {
                    const scheduled = new Date(data.scheduledDate);
                    if (scheduled >= today) {
                        jobs.push({ id: doc.id, ...data });
                    }
                }
            });

            jobs.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
            responseData.upcomingJobs = jobs.slice(0, 5);
        } catch (error) {
            console.error("Error fetching upcoming jobs:", error);
        }

        res.json(responseData);
    } catch (error) {
        console.error("Dashboard stats critical error:", error);
        res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
});

// Revenue Over Time Report (SENSITIVE: Requires 2FA)
router.get("/revenue", authRequired, twoFactorRequired, authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user.businessId;
        const snap = await getCollectionRef('invoices')
            .where('businessId', '==', businessId)
            .orderBy('createdAt', 'desc')
            .limit(1000)
            .get();

        const monthlyRevenue = {};
        const last12Months = [];
        for (let i = 11; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyRevenue[key] = { paid: 0, pending: 0, total: 0 };
            last12Months.push(key);
        }

        snap.forEach(doc => {
            const data = doc.data();
            const date = new Date(data.createdAt);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (monthlyRevenue[key]) {
                const amount = Number(data.total || 0);
                if (data.status === 'paid') {
                    monthlyRevenue[key].paid += amount;
                } else if (data.status === 'pending') {
                    monthlyRevenue[key].pending += amount;
                }
                monthlyRevenue[key].total += amount;
            }
        });

        const chartData = last12Months.map(month => ({
            month,
            ...monthlyRevenue[month]
        }));

        res.json(chartData);
    } catch (error) {
        res.status(500).json({ error: "Revenue report failed" });
    }
});

// Services Distribution Report (SENSITIVE: Requires 2FA)
router.get("/services", authRequired, twoFactorRequired, authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user.businessId;
        const snap = await getCollectionRef('workOrders')
            .where('businessId', '==', businessId)
            .orderBy('createdAt', 'desc')
            .limit(1000)
            .get();

        const distribution = {};
        snap.forEach(doc => {
            const data = doc.data();
            const serviceName = data.serviceName || (data.items && data.items[0]?.name) || "Uncategorized";
            distribution[serviceName] = (distribution[serviceName] || 0) + 1;
        });

        const formattedData = Object.keys(distribution).map(name => ({
            name,
            count: distribution[name]
        })).sort((a, b) => b.count - a.count);

        res.json(formattedData);
    } catch (error) {
        res.status(500).json({ error: "Services report failed" });
    }
});

module.exports = router;
