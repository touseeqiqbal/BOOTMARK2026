const express = require('express');
const router = express.Router();
const { checkFirestoreHealth } = require('../utils/db');
const { authRequired } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/authorize');
const os = require('os');

// Public health check (for load balancers)
router.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// Detailed health check (Auth Required)
router.get('/health', requireAdmin, async (req, res) => {
    try {
        const dbHealthy = await checkFirestoreHealth();

        const healthData = {
            status: dbHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            services: {
                api: 'healthy',
                database: dbHealthy ? 'healthy' : 'unreachable',
                storage: 'healthy'
            },
            system: {
                platform: os.platform(),
                uptime: os.uptime(),
                loadavg: os.loadavg(),
                freeMem: os.freemem(),
                totalMem: os.totalmem()
            },
            version: 'v2.4.0-enterprise'
        };

        res.json(healthData);
    } catch (error) {
        console.error('System Health API Error:', error);
        res.status(500).json({ error: 'Failed to retrieve system health' });
    }
});

module.exports = router;
