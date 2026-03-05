const express = require("express");
const path = require("path");
const { getCollectionRef, getDoc, setDoc, deleteDoc } = require(path.join(__dirname, "..", "utils", "db"));
const { validateRequest, propertySchema } = require(path.join(__dirname, "..", "utils", "validation"));
const { authorize, requireAdmin } = require('../middleware/authorize');
const auditService = require('../utils/EnhancedAuditService');

const router = express.Router();

// Get all properties (filtered by businessId)
async function getProperties(businessId = null) {
    try {
        let query = getCollectionRef('properties');
        if (businessId) {
            query = query.where('businessId', '==', businessId);
        }
        const snap = await query.get();
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        return items;
    } catch (e) {
        console.error('Error fetching properties from Firestore:', e);
        return [];
    }
}

// ============================================
// PROPERTY SETTINGS
// ============================================

// Get property settings
router.get('/settings', authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) {
            return res.status(403).json({ error: 'Business context required' });
        }

        let settings = await getDoc('propertySettings', businessId);

        // Return default settings if none exist
        if (!settings) {
            settings = {
                businessId,
                defaultCity: '',
                defaultState: '',
                defaultZip: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }

        res.json(settings);
    } catch (error) {
        console.error('Error fetching property settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update property settings
router.put('/settings', requireAdmin, async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) {
            return res.status(403).json({ error: 'Business context required' });
        }

        const settings = {
            ...req.body,
            businessId,
            updatedAt: new Date().toISOString()
        };

        // Ensure createdAt exists
        if (!settings.createdAt) {
            settings.createdAt = new Date().toISOString();
        }

        await setDoc('propertySettings', businessId, settings);
        auditService.log(req, 'property.settingsUpdated', 'propertySettings', businessId).catch(() => { });
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error updating property settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Get all properties (PAGINATED)
router.get("/", authorize(['staff']), async (req, res) => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const businessId = req.user?.businessId;
        if (!businessId) {
            return res.status(400).json({ error: "Business registration required." });
        }

        const { paginate } = require(path.join(__dirname, "..", "utils", "pagination"));

        // Build base query
        let baseQuery = getCollectionRef('properties').where('businessId', '==', businessId);

        // Handle customerId filter separately (not in allowedFilters)
        const { customerId } = req.query;
        if (customerId) {
            baseQuery = baseQuery.where('customerId', '==', customerId);
        }

        // Reverted to fetch all properties to prevent frontend crash
        // const result = await paginate({...});

        let q = baseQuery;
        const snapshot = await q.get();
        const properties = [];
        snapshot.forEach(doc => properties.push({ id: doc.id, ...doc.data() }));

        // Sort in memory
        properties.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(properties);
    } catch (error) {
        console.error("Get properties error:", error);
        res.status(500).json({ error: "Failed to fetch properties" });
    }
});

// Get property by ID
router.get("/:id", authorize(['staff']), async (req, res) => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const businessId = req.user?.businessId;
        if (!businessId) {
            return res.status(400).json({ error: "Business registration required" });
        }

        const property = await getDoc('properties', req.params.id);

        if (!property) {
            return res.status(404).json({ error: "Property not found" });
        }

        if (property.businessId !== businessId) {
            return res.status(403).json({ error: "Access denied" });
        }

        res.json(property);
    } catch (error) {
        console.error("Get property error:", error);
        res.status(500).json({ error: "Failed to fetch property" });
    }
});

// Create property
router.post("/", authorize(['staff']), validateRequest(propertySchema), async (req, res) => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const businessId = req.user?.businessId;
        if (!businessId) {
            return res.status(400).json({ error: "Business registration required." });
        }

        const newProperty = {
            id: Date.now().toString(),
            ...req.body,
            businessId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: userId
        };

        await setDoc('properties', newProperty.id, newProperty);
        auditService.log(req, 'property.created', 'property', newProperty.id, {}, { name: newProperty.name }).catch(() => { });
        res.status(201).json(newProperty);
    } catch (error) {
        console.error("Create property error:", error);
        res.status(500).json({ error: "Failed to create property" });
    }
});

// Update property
router.put("/:id", authorize(['staff']), validateRequest(propertySchema), async (req, res) => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const businessId = req.user?.businessId;
        if (!businessId) {
            return res.status(400).json({ error: "Business registration required" });
        }

        const property = await getDoc('properties', req.params.id);

        if (!property) {
            return res.status(404).json({ error: "Property not found" });
        }

        if (property.businessId !== businessId) {
            return res.status(403).json({ error: "Access denied" });
        }

        const updatedProperty = {
            ...property,
            ...req.body,
            id: req.params.id,
            businessId,
            updatedAt: new Date().toISOString()
        };

        await setDoc('properties', req.params.id, updatedProperty);
        const diff = auditService.computeDiff(property, updatedProperty, ['name', 'customerId']);
        auditService.log(req, 'property.updated', 'property', req.params.id, diff).catch(() => { });
        res.json(updatedProperty);
    } catch (error) {
        console.error("Update property error:", error);
        res.status(500).json({ error: "Failed to update property" });
    }
});

// Delete property
router.delete("/:id", requireAdmin, async (req, res) => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const businessId = req.user?.businessId;
        if (!businessId) {
            return res.status(400).json({ error: "Business registration required" });
        }

        const property = await getDoc('properties', req.params.id);

        if (!property) {
            return res.status(404).json({ error: "Property not found" });
        }

        if (property.businessId !== businessId) {
            return res.status(403).json({ error: "Access denied" });
        }

        await deleteDoc('properties', req.params.id);
        auditService.log(req, 'property.deleted', 'property', req.params.id, {}, { name: property.name }).catch(() => { });
        res.json({ message: "Property deleted successfully" });
    } catch (error) {
        console.error("Delete property error:", error);
        res.status(500).json({ error: "Failed to delete property" });
    }
});

module.exports = { router, getProperties };
