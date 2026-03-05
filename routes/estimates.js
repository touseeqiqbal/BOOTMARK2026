const express = require("express");
const estimateService = require("../utils/EstimateService");
const router = express.Router();
const { getCollectionRef } = require("../utils/db");
const { validateRequest, estimateSchema } = require("../utils/validation");
const { paginate } = require("../utils/pagination");
const { authorize, requireAdmin } = require("../middleware/authorize");
const auditService = require('../utils/EnhancedAuditService');

router.get("/", authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(400).json({ error: "Business ID required" });

        // Reverted to fetch all estimates to prevent frontend crash
        // Using SAFE Business ID query
        const estimates = await estimateService.getEstimatesByBusinessId(businessId);

        // Default sort by createdAt desc
        estimates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(estimates);
    } catch (error) {
        console.error("Error fetching estimates:", error);
        res.status(500).json({ error: "Failed to fetch estimates" });
    }
});

router.get("/:id", authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(400).json({ error: "Business ID required" });

        const estimate = await estimateService.getEstimateById(req.params.id);

        if (!estimate) return res.status(404).json({ error: "Estimate not found" });
        if (estimate.businessId !== businessId) return res.status(403).json({ error: "Access denied" });

        res.json(estimate);
    } catch (error) {
        res.status(500).json({ error: "Failed" });
    }
});

router.post("/", authorize(['staff']), validateRequest(estimateSchema), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(400).json({ error: "Business ID required" });

        // Pass userId if needed for "Created By" field, but businessId is primary context
        req.body.userId = req.user.uid || req.user.id;

        const estimate = await estimateService.createEstimate(businessId, req.body);
        auditService.log(req, 'estimate.created', 'estimate', estimate.id, {}, { total: estimate.total }).catch(() => { });
        res.status(201).json(estimate);
    } catch (error) {
        res.status(500).json({ error: "Failed" });
    }
});

router.put("/:id", authorize(['staff']), validateRequest(estimateSchema), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(400).json({ error: "Business ID required" });

        const updated = await estimateService.updateEstimate(req.params.id, businessId, req.body);
        auditService.log(req, 'estimate.updated', 'estimate', req.params.id, {}, { status: updated.status }).catch(() => { });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete("/:id", requireAdmin, async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(400).json({ error: "Business ID required" });

        await estimateService.deleteEstimate(req.params.id, businessId);
        auditService.log(req, 'estimate.deleted', 'estimate', req.params.id).catch(() => { });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed" });
    }
});

module.exports = router;
