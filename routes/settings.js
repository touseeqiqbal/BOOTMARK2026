const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const { authorize, requireAdmin } = require('../middleware/authorize');
const { getNumberFormats, updateNumberFormats, previewNumber, DEFAULT_FORMATS } = require('../utils/numberGenerator');
const { validateRequest, numberFormatSchema } = require('../utils/validation');

router.get('/number-formats', authRequired, authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });
        const formats = await getNumberFormats(businessId);
        res.json(formats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch number formats' });
    }
});

router.put('/number-formats', authRequired, requireAdmin, async (req, res) => {
    try {
        const businessId = req.user.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });
        const formats = req.body;
        const updatedFormats = await updateNumberFormats(businessId, formats);
        res.json(updatedFormats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update number formats' });
    }
});

router.post('/number-formats/preview', authRequired, authorize(['staff']), validateRequest(numberFormatSchema), async (req, res) => {
    try {
        const { format, counter, padding } = req.body;
        if (!format) return res.status(400).json({ error: 'Format string is required' });
        const preview = previewNumber(format, counter || 1, padding || 5);
        res.json({ preview });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate preview' });
    }
});

router.get('/number-formats/defaults', authRequired, authorize(['staff']), async (req, res) => {
    res.json(DEFAULT_FORMATS);
});

module.exports = router;
