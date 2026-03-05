const express = require('express');
const router = express.Router();
const { db } = require('../utils/db');
const { authRequired } = require('../middleware/auth');
const { authorize, requireAdmin } = require('../middleware/authorize');
const { validateRequest, workOrderTemplateSchema } = require('../utils/validation');
const logger = require('../utils/logger');

// Get all work order templates for the business
router.get('/', authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user?.businessId;

        if (!businessId) {
            logger.warn('Access attempt without businessId', { path: '/api/work-order-templates', userId: req.user?.uid });
            return res.status(400).json({ error: 'Business registration required. Please register your business first.' });
        }

        const templatesRef = db.collection('workOrderTemplates');
        const snapshot = await templatesRef.where('businessId', '==', businessId).get();

        const templates = [];
        snapshot.forEach(doc => {
            templates.push({ id: doc.id, ...doc.data() });
        });

        res.json(templates);
    } catch (error) {
        logger.error('Failed to fetch templates', { userId: req.user?.uid, error: error.message });
        res.status(500).json({ error: 'Failed to fetch work order templates' });
    }
});

// Get a single work order template
router.get('/:id', authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user?.businessId;

        if (!businessId) {
            return res.status(400).json({ error: 'Business registration required' });
        }

        const templateDoc = await db.collection('workOrderTemplates').doc(req.params.id).get();

        if (!templateDoc.exists) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const template = templateDoc.data();
        if (template.businessId !== businessId) {
            console.log('[WorkOrderTemplates] Access denied - wrong business');
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ id: templateDoc.id, ...template });
    } catch (error) {
        logger.error('Error fetching template', { templateId: req.params.id, error: error.message });
        res.status(500).json({ error: 'Failed to fetch work order template' });
    }
});

// Create a new work order template
router.post('/', requireAdmin, validateRequest(workOrderTemplateSchema), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) {
            return res.status(400).json({ error: 'Business registration required. Please register your business first.' });
        }

        const { name, title, description, defaultDuration, defaultPrice, defaultStatus, fields, settings } = req.body;

        // Support both 'name' and 'title' for compatibility
        const templateName = name || title;
        if (!templateName) {
            return res.status(400).json({ error: 'Template name is required' });
        }

        const templateData = {
            businessId,
            name: templateName,
            title: templateName,
            description: description || '',
            defaultDuration: defaultDuration || settings?.defaultDuration || '',
            defaultPrice: defaultPrice || settings?.defaultPrice || '',
            defaultStatus: defaultStatus || settings?.defaultStatus || 'draft',
            fields: fields || [],
            settings: settings || {
                defaultDuration: defaultDuration || '',
                defaultPrice: defaultPrice || '',
                defaultStatus: defaultStatus || 'draft'
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: req.user.uid
        };

        const docRef = await db.collection('workOrderTemplates').add(templateData);
        logger.info('Work order template created', { templateId: docRef.id, userId: req.user.uid });

        res.status(201).json({ id: docRef.id, ...templateData });
    } catch (error) {
        logger.error('Error creating template', { error: error.message, userId: req.user?.uid });
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// Update a work order template
router.put('/:id', requireAdmin, validateRequest(workOrderTemplateSchema), async (req, res) => {
    try {
        const businessId = req.user?.businessId;

        if (!businessId) {
            return res.status(400).json({ error: 'Business registration required' });
        }

        const templateRef = db.collection('workOrderTemplates').doc(req.params.id);
        const templateDoc = await templateRef.get();

        if (!templateDoc.exists) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const template = templateDoc.data();
        if (template.businessId !== businessId) {
            console.log('[WorkOrderTemplates] Access denied - wrong business');
            return res.status(403).json({ error: 'Access denied' });
        }

        const { name, title, description, defaultDuration, defaultPrice, defaultStatus, fields, settings } = req.body;

        const updateData = {
            name: name || title || template.name,
            title: title || name || template.title,
            description: description !== undefined ? description : template.description,
            defaultDuration: defaultDuration !== undefined ? defaultDuration : (settings?.defaultDuration || template.defaultDuration),
            defaultPrice: defaultPrice !== undefined ? defaultPrice : (settings?.defaultPrice || template.defaultPrice),
            defaultStatus: defaultStatus || settings?.defaultStatus || template.defaultStatus,
            fields: fields !== undefined ? fields : template.fields,
            settings: settings || template.settings || {},
            updatedAt: new Date().toISOString(),
            updatedBy: req.user.uid
        };

        await templateRef.update(updateData);
        logger.info('Work order template updated', { templateId: req.params.id, userId: req.user.uid });

        res.json({ id: req.params.id, ...template, ...updateData });
    } catch (error) {
        logger.error('Error updating template', { templateId: req.params.id, error: error.message });
        res.status(500).json({ error: 'Failed to update template' });
    }
});

// Delete a work order template
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const businessId = req.user?.businessId;

        if (!businessId) {
            return res.status(400).json({ error: 'Business registration required' });
        }

        const templateRef = db.collection('workOrderTemplates').doc(req.params.id);
        const templateDoc = await templateRef.get();

        if (!templateDoc.exists) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const template = templateDoc.data();
        if (template.businessId !== businessId) {
            logger.security('Cross-tenant delete attempt', { path: `/api/work-order-templates/${req.params.id}`, userId: req.user?.uid });
            return res.status(403).json({ error: 'Access denied' });
        }

        await templateRef.delete();
        logger.info('Work order template deleted', { templateId: req.params.id, userId: req.user.uid });
        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        logger.error('Error deleting template', { templateId: req.params.id, error: error.message });
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

module.exports = router;
