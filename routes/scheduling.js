const express = require("express");
const schedulingService = require("../utils/SchedulingService");
const router = express.Router();
const { validateRequest, scheduleSchema } = require('../utils/validation');
const { authorize, requireAdmin } = require('../middleware/authorize');
const auditService = require('../utils/EnhancedAuditService');

router.get("/", authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });
        const events = await schedulingService.getEvents(businessId);
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: "Failed" });
    }
});

router.get("/:id", authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });
        const event = await schedulingService.getEventById(req.params.id, businessId);
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: "Failed" });
    }
});

router.post("/", authorize(['staff']), validateRequest(scheduleSchema), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });
        const event = await schedulingService.createEvent(businessId, req.body);
        auditService.log(req, 'schedule.created', 'schedule', event.id, {}, { title: event.title }).catch(() => { });
        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ error: "Failed" });
    }
});

router.put("/:id", authorize(['staff']), validateRequest(scheduleSchema), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });
        const updated = await schedulingService.updateEvent(req.params.id, businessId, req.body);
        auditService.log(req, 'schedule.updated', 'schedule', req.params.id, {}, { title: updated.title }).catch(() => { });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: "Failed" });
    }
});

router.delete("/:id", requireAdmin, async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });
        await schedulingService.deleteEvent(req.params.id, businessId);
        auditService.log(req, 'schedule.deleted', 'schedule', req.params.id).catch(() => { });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed" });
    }
});

module.exports = router;
