const express = require("express");
const router = express.Router();
const formService = require("../utils/FormService");

const GLOBAL_TEMPLATES = [
    {
        id: 'tpl_landscaping_quote',
        type: 'form',
        name: 'Landscaping Design Quote',
        description: 'Comprehensive intake form for new design projects including site details and budget.',
        category: 'Sales',
        data: {
            title: 'Landscaping Design Quote',
            description: 'New project intake form',
            fields: [
                { id: 'f1', type: 'text', label: 'Client Name', required: true },
                { id: 'f2', type: 'number', label: 'Estimated Square Footage', required: true },
                { id: 'f3', type: 'textarea', label: 'Design Preferences' },
                { id: 'f4', type: 'select', label: 'Timeline', options: ['ASAP', '1-3 Months', '3-6 Months', 'Next Season'] }
            ]
        }
    },
    {
        id: 'tpl_commercial_invoice',
        type: 'form',
        name: 'Commercial Service Invoice',
        description: 'Detailed billing template optimized for commercial contracts and bulk work.',
        category: 'Finance',
        data: {
            title: 'Commercial Service Invoice',
            description: 'Specialized commercial billing form',
            fields: [
                { id: 'i1', type: 'text', label: 'Purchase Order #', required: true },
                { id: 'i2', type: 'date', label: 'Service Date', required: true },
                { id: 'i3', type: 'number', label: 'Contract Rate Overide' }
            ]
        }
    },
    {
        id: 'tpl_maintenance_workflow',
        type: 'workflow',
        name: 'Premium Maintenance Cycle',
        description: 'Optimized 12-step workflow for residential lawn maintenance and fertilization.',
        category: 'Operations',
        data: {
            name: 'Premium Maintenance Cycle',
            steps: [
                { id: 's1', name: 'Site Inspection', type: 'task' },
                { id: 's2', name: 'Mowing', type: 'task' },
                { id: 's3', name: 'Edging', type: 'task' },
                { id: 's4', name: 'Cleanup', type: 'task' }
            ]
        }
    }
];

router.get("/templates", (req, res) => {
    res.json(GLOBAL_TEMPLATES);
});

router.post("/install", async (req, res) => {
    try {
        const { templateId } = req.body;
        const businessId = req.user?.businessId;
        const userId = req.user?.uid || req.user?.id;

        if (!businessId) return res.status(403).json({ error: 'Business context required' });

        const template = GLOBAL_TEMPLATES.find(t => t.id === templateId);
        if (!template) return res.status(404).json({ error: 'Template not found' });

        if (template.type === 'form') {
            const formData = {
                ...template.data,
                businessId,
                userId,
                createdAt: new Date().toISOString(),
                status: 'published'
            };
            // creatorId, ownerId, businessId
            await formService.createForm(formData, userId, userId, businessId);
        } else if (template.type === 'workflow') {
            // Mock workflow installation if service exists
            console.log('Installing workflow template:', template.name);
            // In a real app: await workflowService.createWorkflow(template.data, businessId);
        }

        res.json({
            success: true,
            message: `${template.name} installed successfully`,
            type: template.type
        });
    } catch (error) {
        console.error('Marketplace Install Error:', error);
        res.status(500).json({ error: 'Failed to install template' });
    }
});

module.exports = router;
