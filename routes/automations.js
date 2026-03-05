const express = require('express');
const router = express.Router();
const path = require('path');
const { getCollectionRef, getDoc, setDoc, deleteDoc, db } = require('../utils/db');
const crypto = require('crypto');
const { authRequired } = require('../middleware/auth');
const { authorize, requireAdmin } = require('../middleware/authorize');
const auditService = require('../utils/EnhancedAuditService');
const { validateRequest, automationRuleSchema } = require('../utils/validation');

// GET /api/automations - List all rules for the business
router.get('/', authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user.businessId;
        if (!businessId) return res.status(400).json({ error: 'Business context required' });

        const snap = await getCollectionRef('automationRules')
            .where('businessId', '==', businessId)
            .get();

        const rules = [];
        snap.forEach(doc => rules.push({ id: doc.id, ...doc.data() }));
        res.json(rules);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch rules' });
    }
});

// POST /api/automations - Create a new rule
router.post('/', requireAdmin, validateRequest(automationRuleSchema), async (req, res) => {
    try {
        const businessId = req.user.businessId;
        if (!businessId) return res.status(400).json({ error: 'Business context required' });

        const ruleId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
        const newRule = {
            id: ruleId,
            businessId,
            name: req.body.name || 'New Rule',
            event: req.body.event, // e.g., 'workOrder.statusChanged'
            enabled: true,
            conditions: req.body.conditions || {},
            actions: req.body.actions || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (!newRule.event || !newRule.actions.length) {
            return res.status(400).json({ error: 'Event and actions are required' });
        }

        await setDoc('automationRules', ruleId, newRule);
        auditService.log(req, 'automation.created', 'automationRule', ruleId, {}, { name: newRule.name, event: newRule.event }).catch(() => { });
        res.status(201).json(newRule);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create rule' });
    }
});

// PUT /api/automations/:id - Update a rule
router.put('/:id', requireAdmin, validateRequest(automationRuleSchema), async (req, res) => {
    try {
        const businessId = req.user.businessId;
        const { id } = req.params;

        const rule = await getDoc('automationRules', id);
        if (!rule || rule.businessId !== businessId) {
            return res.status(404).json({ error: 'Rule not found' });
        }

        const updates = {
            ...req.body,
            id,
            businessId,
            updatedAt: new Date().toISOString()
        };

        await setDoc('automationRules', id, updates);
        const diff = auditService.computeDiff(rule, updates, ['name', 'enabled', 'event']);
        auditService.log(req, 'automation.updated', 'automationRule', id, diff).catch(() => { });
        res.json(updates);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update rule' });
    }
});

// DELETE /api/automations/:id - Delete a rule
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const businessId = req.user.businessId;
        const { id } = req.params;

        const rule = await getDoc('automationRules', id);
        if (!rule || rule.businessId !== businessId) {
            return res.status(404).json({ error: 'Rule not found' });
        }

        await deleteDoc('automationRules', id);
        auditService.log(req, 'automation.deleted', 'automationRule', id, {}, { name: rule.name }).catch(() => { });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete rule' });
    }
});

// GET /api/automations/logs - Fetch execution logs
router.get('/logs', authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user.businessId;
        const snap = await getCollectionRef('automationLogs')
            .where('businessId', '==', businessId)
            .orderBy('timestamp', 'desc')
            .limit(50)
            .get();

        const logs = [];
        snap.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

module.exports = router;
