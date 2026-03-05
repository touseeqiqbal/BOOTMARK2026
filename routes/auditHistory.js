const express = require('express');
const router = express.Router();
const auditService = require('../utils/AuditService');
const { authRequired } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/authorize');

// Get audit logs for the current business
router.get('/', requireAdmin, async (req, res) => {
    try {
        const businessId = req.user.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });

        const { limit = 50, offset = 0, resource, action, userId } = req.query;

        const filters = {
            businessId,
            resource,
            action,
            userId
        };

        const logs = await auditService.getLogs(filters, parseInt(limit), parseInt(offset));
        res.json(logs);
    } catch (error) {
        console.error('Audit Router Error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// Export logs (CSV/JSON) - placeholder for Phase 9 extension
router.get('/export', requireAdmin, async (req, res) => {
    // Implementation for CSV export would go here
    res.status(501).json({ error: 'Export functionality coming soon' });
});

module.exports = router;
