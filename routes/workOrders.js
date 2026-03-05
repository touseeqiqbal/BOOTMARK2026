const express = require('express');
const router = express.Router();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const {
    getCollectionRef,
    getDoc,
    setDoc,
    deleteDoc
} = require(path.join(__dirname, "..", "utils", "db"));
const { generateNumber } = require(path.join(__dirname, "..", "utils", "numberGenerator"));
const { validateRequest, workOrderSchema } = require(path.join(__dirname, "..", "utils", "validation"));
const { sendEmail } = require(path.join(__dirname, "..", "utils", "emailService"));
const automationService = require(path.join(__dirname, "..", "utils", "AutomationService"));
const { escapeHTML } = require(path.join(__dirname, "..", "utils", "htmlSanitizer"));
const { authorize, requireAdmin } = require('../middleware/authorize');
const metricsService = require('../utils/MetricsService');
const auditService = require('../utils/EnhancedAuditService');

// Helper: Read work orders
const readWorkOrders = async (businessId = null, options = {}) => {
    try {
        let query = getCollectionRef('workOrders');
        if (businessId) {
            query = query.where('businessId', '==', businessId);
        }

        // Apply basic filters in Firestore to avoid full scan
        if (options.clientId) query = query.where('clientId', '==', options.clientId);
        if (options.status) query = query.where('status', '==', options.status);
        if (options.propertyId) query = query.where('propertyId', '==', options.propertyId);

        // Safety limit
        const limit = options.limit || 500;
        const snapshot = await query.orderBy('createdAt', 'desc').limit(limit).get();

        const items = [];
        snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
        return items;
    } catch (error) {
        console.error('Firestore read error:', error);
        return [];
    }
};

const DEFAULT_STATUSES = ['draft', 'pending', 'scheduled', 'in_progress', 'completed', 'on_hold', 'cancelled'];

const validateStatus = async (status, workflowId, businessId) => {
    if (!status) return true; // Optional updates allowed, status might not change

    // Always allow system final states
    if (['completed', 'cancelled'].includes(status)) return true;

    if (workflowId) {
        const workflow = await getDoc('workflows', workflowId);
        if (workflow && workflow.businessId === businessId && workflow.stages) {
            const stageNames = workflow.stages.map(s => s.name);
            return stageNames.includes(status) || DEFAULT_STATUSES.includes(status);
        }
    }

    return DEFAULT_STATUSES.includes(status);
};


// GET all work orders (PAGINATED & LIMITED)
router.get('/', authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        const limit = parseInt(req.query.limit) || 50;
        const lastVisibleId = req.query.lastVisibleId;

        if (!businessId) {
            return res.status(403).json({ error: 'Business ID required' });
        }

        let query = getCollectionRef('workOrders')
            .where('businessId', '==', businessId)
            .orderBy('createdAt', 'desc')
            .limit(limit);

        if (lastVisibleId) {
            const lastDoc = await getCollectionRef('workOrders').doc(lastVisibleId).get();
            if (lastDoc.exists) {
                query = query.startAfter(lastDoc);
            }
        }

        const snapshot = await query.get();
        const orders = [];
        snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));

        res.json({
            items: orders,
            lastId: orders.length > 0 ? orders[orders.length - 1].id : null,
            hasMore: orders.length === limit
        });
    } catch (error) {
        console.error('Error fetching work orders:', error);
        res.status(500).json({ error: 'Failed to fetch work orders' });
    }
});

// GET query filter
router.get('/query', authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        const orders = await readWorkOrders(businessId, {
            clientId: req.query.clientId,
            status: req.query.status,
            propertyId: req.query.propertyId,
            limit: 100 // Tighter limit for ad-hoc queries
        });

        res.json(orders);
    } catch (error) {
        console.error('Error querying work orders:', error);
        res.status(500).json({ error: 'Failed to query work orders' });
    }
});

// GET work orders assigned to current user
router.get('/assigned', authorize(['staff']), async (req, res) => {
    try {
        const userId = req.user?.uid;
        const businessId = req.user?.businessId;

        if (!userId || !businessId) {
            return res.status(403).json({ error: 'Authentication required' });
        }

        const snapshot = await getCollectionRef('workOrders')
            .where('businessId', '==', businessId)
            .where('assignedTo', 'array-contains', userId)
            .limit(50)
            .get();

        const orders = [];
        snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));

        // Sort by scheduledDate (desc) or createdAt
        orders.sort((a, b) => new Date(b.scheduledDate || b.createdAt) - new Date(a.scheduledDate || a.createdAt));

        res.json(orders);
    } catch (error) {
        console.error('Error fetching assigned work orders:', error);
        res.status(500).json({ error: 'Failed to fetch assigned work orders' });
    }
});

// PATCH update work order status (Quick update)
router.patch('/:id/status', authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const existing = await getDoc('workOrders', req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        // Check business access (allow if admin or if the user is assigned)
        const isAssigned = existing.assignedTo?.includes(req.user?.uid);
        if (businessId && existing.businessId !== businessId && !isAssigned) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Validate status
        const isValid = await validateStatus(status, existing.workflowId, existing.businessId);
        if (!isValid) {
            return res.status(400).json({ error: `Invalid status: ${status}` });
        }

        const updatedAt = new Date().toISOString();
        const updatedFields = {
            status,
            updatedAt,
            // Automatically log actual start/completion if status changes
            ...(status === 'in_progress' && !existing.actualStartTime && { actualStartTime: updatedAt }),
            ...(status === 'completed' && !existing.actualEndTime && { actualEndTime: updatedAt })
        };

        const updatedOrder = { ...existing, ...updatedFields };
        await setDoc('workOrders', req.params.id, updatedOrder);

        // 🟢 TRIGGER AUTOMATION: Status Changed
        if (status !== existing.status) {
            automationService.trigger('workOrder.statusChanged', {
                businessId: existing.businessId,
                entityId: req.params.id,
                eventName: 'workOrder.statusChanged',
                data: updatedOrder,
                previousData: existing
            }).catch(err => console.error('[Automation) Trigger failed:', err));
        }

        // Audit log for status change
        if (status !== existing.status) {
            auditService.log(req, 'workOrder.statusChanged', 'workOrder', req.params.id, {
                status: { old: existing.status, new: status }
            }).catch(() => { });
            metricsService.updateWorkOrderSummary(existing.businessId, existing.status, status).catch(() => { });
        }

        res.json({ success: true, order: updatedOrder });
    } catch (error) {
        console.error('Error updating work order status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// ============================================
// WORK ORDER SETTINGS / CUSTOMIZATION
// ============================================

// Get work order settings for a business
router.get('/settings', authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });
        if (!businessId) {
            return res.status(400).json({ error: 'Business ID is required' });
        }

        let settings = await getDoc('workOrderSettings', businessId);

        // Return default settings if none exist
        if (!settings) {
            settings = {
                businessId,
                defaultFields: {
                    scheduledDate: { visible: true, required: false, label: 'Scheduled Date' },
                    status: { visible: true, required: true, label: 'Status' },
                    price: { visible: true, required: false, label: 'Price' },
                    startTime: { visible: true, required: false, label: 'Start Time' },
                    finishTime: { visible: true, required: false, label: 'Finish Time' },
                    deicingMaterial: { visible: true, required: false, label: 'Deicing Material?' },
                    estimatedDuration: { visible: false, required: false, label: 'Estimated Duration' },
                    description: { visible: true, required: false, label: 'Description (Additional Notes)' },
                    notes: { visible: true, required: false, label: 'Internal Notes' }
                },
                customFields: [],
                fieldOrder: ['client', 'property', 'scheduledDate', 'status', 'price', 'startTime', 'finishTime', 'deicingMaterial'],
                templates: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }

        res.json(settings);
    } catch (error) {
        console.error('Error fetching work order settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update work order settings
router.put('/settings', requireAdmin, async (req, res) => {
    try {
        // STRICT: Only allow authenticated user's business
        const businessId = req.user?.businessId;
        if (!businessId) {
            return res.status(400).json({ error: 'Business ID is required' });
        }

        // PREVENT POISONING: Only allow specific fields
        const { defaultFields, customFields, fieldOrder, templates } = req.body;

        const settings = {
            defaultFields: defaultFields || {},
            customFields: customFields || [],
            fieldOrder: fieldOrder || [],
            templates: templates || [],
            businessId, // Force correct businessId
            updatedAt: new Date().toISOString()
        };

        // Preserve creation date if exists, or set new
        // We need to fetch existing to preserve createdAt if not sent (or just let it be)
        // Usually better to fetch-merge-save for settings to avoid wiping unrelated data if schema expands
        const existing = await getDoc('workOrderSettings', businessId);
        if (existing && existing.createdAt) {
            settings.createdAt = existing.createdAt;
        } else {
            settings.createdAt = new Date().toISOString();
        }

        await setDoc('workOrderSettings', businessId, settings);
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error updating work order settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Add custom field
router.post('/settings/custom-field', requireAdmin, async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });
        if (!businessId) {
            return res.status(400).json({ error: 'Business ID is required' });
        }

        const { name, label, type, options, required, placeholder, helpText } = req.body;

        if (!name || !label || !type) {
            return res.status(400).json({ error: 'Name, label, and type are required' });
        }

        // Get current settings
        let settings = await getDoc('workOrderSettings', businessId);

        if (!settings) {
            return res.status(404).json({ error: 'Settings not found. Please initialize settings first.' });
        }

        // Create new custom field
        const customField = {
            id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            label,
            type,
            options: options || [],
            required: required || false,
            placeholder: placeholder || '',
            helpText: helpText || '',
            order: settings.customFields ? settings.customFields.length : 0,
            createdAt: new Date().toISOString()
        };

        if (!settings.customFields) settings.customFields = [];
        settings.customFields.push(customField);
        settings.updatedAt = new Date().toISOString();

        // Save updated settings
        await setDoc('workOrderSettings', businessId, settings);

        res.json({ success: true, customField, settings });
    } catch (error) {
        console.error('Error adding custom field:', error);
        res.status(500).json({ error: 'Failed to add custom field' });
    }
});

// Delete custom field
router.delete('/settings/custom-field/:fieldId', requireAdmin, async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });
        if (!businessId) {
            return res.status(400).json({ error: 'Business ID is required' });
        }

        const { fieldId } = req.params;

        // Get current settings
        let settings = await getDoc('workOrderSettings', businessId);

        if (!settings) {
            return res.status(404).json({ error: 'Settings not found' });
        }

        // Remove custom field
        if (settings.customFields) {
            settings.customFields = settings.customFields.filter(f => f.id !== fieldId);
        }
        settings.updatedAt = new Date().toISOString();

        // Save updated settings
        await setDoc('workOrderSettings', businessId, settings);

        res.json({ success: true, settings });
    } catch (error) {
        console.error('Error deleting custom field:', error);
        res.status(500).json({ error: 'Failed to delete custom field' });
    }
});

// GET single work order
router.get('/:id', authorize(['staff']), async (req, res) => {
    try {
        const order = await getDoc('workOrders', req.params.id);
        if (!order) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        // Check business access
        if (req.user?.businessId && order.businessId !== req.user.businessId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(order);
    } catch (error) {
        console.error('Error fetching work order:', error);
        res.status(500).json({ error: 'Failed to fetch work order' });
    }
});

// POST create work order
router.post('/', authorize(['staff']), validateRequest(workOrderSchema), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });

        if (!businessId) {
            return res.status(400).json({ error: 'Business ID is required' });
        }

        if (!req.body.clientId) {
            return res.status(400).json({ error: 'Client ID is required' });
        }

        // ==========================================
        // WORKFLOW HANDLING
        // ==========================================
        let workflowId = req.body.workflowId;
        let initialStatus = 'draft';

        // If workflowId provided, verify it belongs to business
        if (workflowId) {
            const workflow = await getDoc('workflows', workflowId);
            if (!workflow || workflow.businessId !== businessId) {
                return res.status(400).json({ error: 'Invalid workflow ID' });
            }
            // Use first stage as initial status if not specified
            if (workflow.stages && workflow.stages.length > 0) {
                // If status provided, validate it matches a stage (optional, but good practice)
                // For now, just default to first stage if status not provided or 'draft'
                if (!req.body.status || req.body.status === 'draft') {
                    initialStatus = workflow.stages[0].name; // Or ID, depending on frontend implementation. Using Name for readability.
                } else {
                    initialStatus = req.body.status;
                }
            }
        } else {
            // If no workflowId provided, check for default workflow
            const workflowsRef = getCollectionRef('workflows')
                .where('businessId', '==', businessId)
                .where('isDefault', '==', true)
                .limit(1);

            const defaultWorkflowSnapshot = await workflowsRef.get();
            if (!defaultWorkflowSnapshot.empty) {
                const defaultWorkflow = { id: defaultWorkflowSnapshot.docs[0].id, ...defaultWorkflowSnapshot.docs[0].data() };
                workflowId = defaultWorkflow.id;
                if (defaultWorkflow.stages && defaultWorkflow.stages.length > 0) {
                    initialStatus = defaultWorkflow.stages[0].name;
                }
            }
        }

        const id = uuidv4();

        // Generate work order number using custom format
        let workOrderNumber;
        try {
            workOrderNumber = await generateNumber(businessId, 'workOrder');
        } catch (error) {
            console.error('Error generating work order number:', error);
            // Fallback to timestamp-based number if generation fails
            workOrderNumber = `WO-${Date.now().toString().slice(-6)}`;
        }

        const newOrder = {
            id,
            businessId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: req.body.status || initialStatus, // Use provided status or calculated initial status
            workflowId: workflowId || null, // Store workflow association
            workOrderNumber,
            ...req.body
        };

        // Ensure status is set if we overrode it
        if (!req.body.status) {
            newOrder.status = initialStatus;
        }

        // VALIDATE STATUS
        const isValidStatus = await validateStatus(newOrder.status, workflowId, businessId);
        if (!isValidStatus) {
            return res.status(400).json({ error: `Invalid status: ${newOrder.status}` });
        }

        await setDoc('workOrders', id, newOrder);

        // Metrics + Audit
        metricsService.incrementCounter(businessId, 'work_order_count', 1).catch(() => { });
        metricsService.updateWorkOrderSummary(businessId, null, newOrder.status).catch(() => { });
        auditService.log(req, 'workOrder.created', 'workOrder', id, {
            status: { old: null, new: newOrder.status },
            clientId: { old: null, new: newOrder.clientId }
        }).catch(() => { });

        res.status(201).json(newOrder);
    } catch (error) {
        console.error('Error creating work order:', error);
        res.status(500).json({ error: 'Failed to create work order' });
    }
});

// PUT update work order
router.put('/:id', authorize(['staff']), validateRequest(workOrderSchema), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        const existing = await getDoc('workOrders', req.params.id);

        if (!existing) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        // Check business access
        if (businessId && existing.businessId !== businessId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // VALIDATE STATUS TRANSITION
        if (req.body.status) {
            const isValid = await validateStatus(req.body.status, existing.workflowId, existing.businessId);
            if (!isValid) {
                return res.status(400).json({ error: `Invalid status: ${req.body.status}` });
            }
        }

        const updatedOrder = {
            ...existing,
            ...req.body,
            id: req.params.id,
            businessId: existing.businessId, // Prevent businessId from being changed
            updatedAt: new Date().toISOString()
        };

        await setDoc('workOrders', req.params.id, updatedOrder);

        // Audit log with diff
        const diff = auditService.computeDiff(existing, updatedOrder, ['status', 'clientId', 'assignedTo', 'scheduledDate', 'price']);
        auditService.log(req, 'workOrder.updated', 'workOrder', req.params.id, diff).catch(() => { });

        // Status change metrics
        if (req.body.status && req.body.status !== existing.status) {
            metricsService.updateWorkOrderSummary(existing.businessId, existing.status, req.body.status).catch(() => { });
        }

        // 🟢 TRIGGER AUTOMATION: Status Changed
        if (req.body.status && req.body.status !== existing.status) {
            automationService.trigger('workOrder.statusChanged', {
                businessId: existing.businessId,
                entityId: req.params.id,
                eventName: 'workOrder.statusChanged',
                data: updatedOrder,
                previousData: existing
            }).catch(err => console.error('[Automation] Trigger failed:', err));
        }

        res.json(updatedOrder);
    } catch (error) {
        console.error('Error updating work order:', error);
        res.status(500).json({ error: 'Failed to update work order' });
    }
});

// DELETE work order
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        const order = await getDoc('workOrders', req.params.id);

        if (!order) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        // Check business access
        if (businessId && order.businessId !== businessId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await deleteDoc('workOrders', req.params.id);

        // Metrics + Audit
        metricsService.incrementCounter(businessId, 'work_order_count', -1).catch(() => { });
        metricsService.updateWorkOrderSummary(businessId, order.status, null).catch(() => { });
        auditService.log(req, 'workOrder.deleted', 'workOrder', req.params.id, {
            status: { old: order.status, new: null }
        }).catch(() => { });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting work order:', error);
        res.status(500).json({ error: 'Failed to delete work order' });
    }
});

// GET work order as PDF (HTML Content)
router.get('/:id/pdf', authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        const workOrder = await getDoc('workOrders', req.params.id);

        if (!workOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        // Check business access
        if (businessId && workOrder.businessId !== businessId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Generate HTML for PDF
        const itemsHtml = (workOrder.items || []).map(item => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHTML(item.name || item.description || 'Item')}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${Number(item.price || 0).toFixed(2)}</td>
            </tr>
        `).join('');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Work Order ${escapeHTML(workOrder.workOrderNumber)}</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 40px; }
                    .header { background: #4f46e5; color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
                    .header h1 { margin: 0; font-size: 28px; }
                    .section { margin-bottom: 20px; }
                    .section-title { font-size: 18px; font-weight: bold; color: #4f46e5; margin-bottom: 10px; border-bottom: 2px solid #4f46e5; padding-bottom: 5px; }
                    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                    th { background: #f3f4f6; padding: 10px; text-align: left; font-weight: 600; }
                    td { padding: 8px; }
                    .total { font-size: 20px; font-weight: bold; text-align: right; margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 8px; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
                    .info-item { padding: 10px; background: #f9fafb; border-radius: 6px; }
                    .info-label { font-weight: 600; color: #6b7280; font-size: 12px; text-transform: uppercase; }
                    .info-value { font-size: 16px; margin-top: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Work Order</h1>
                    <p style="margin: 5px 0 0 0; font-size: 16px;">#${escapeHTML(workOrder.workOrderNumber || workOrder.id)}</p>
                </div>

                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Client</div>
                        <div class="info-value">${escapeHTML(workOrder.clientName || 'N/A')}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Status</div>
                        <div class="info-value" style="text-transform: capitalize;">${escapeHTML(workOrder.status || 'Draft')}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Address</div>
                        <div class="info-value">${escapeHTML(workOrder.address || 'N/A')}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Date</div>
                        <div class="info-value">${workOrder.scheduledDate ? new Date(workOrder.scheduledDate).toLocaleDateString() : 'Not scheduled'}</div>
                    </div>
                </div>

                ${workOrder.title ? `
                <div class="section">
                    <div class="section-title">Title</div>
                    <p>${escapeHTML(workOrder.title)}</p>
                </div>
                ` : ''}

                ${workOrder.description ? `
                <div class="section">
                    <div class="section-title">Description</div>
                    <p>${escapeHTML(workOrder.description)}</p>
                </div>
                ` : ''}

                ${workOrder.items && workOrder.items.length > 0 ? `
                <div class="section">
                    <div class="section-title">Items</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th style="text-align: right;">Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                    </table>
                    <div class="total">
                        Total: $${Number(workOrder.price || workOrder.totalAmount || 0).toFixed(2)}
                    </div>
                </div>
                ` : ''}

                ${workOrder.notes ? `
                <div class="section">
                    <div class="section-title">Notes</div>
                    <p>${escapeHTML(workOrder.notes)}</p>
                </div>
                ` : ''}

                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
                    <p>Generated on ${new Date().toLocaleDateString()}</p>
                </div>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="work-order-${workOrder.workOrderNumber || req.params.id}.html"`);
        res.send(html);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// POST email work order
router.post('/:id/email', authorize(['staff']), async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        const { to, message } = req.body;

        if (!to || !to.includes('@')) {
            return res.status(400).json({ error: 'Valid email address is required' });
        }

        const workOrder = await getDoc('workOrders', req.params.id);

        if (!workOrder) {
            return res.status(404).json({ error: 'Work order not found' });
        }

        // Check business access
        if (businessId && workOrder.businessId !== businessId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get user/business info for email
        const user = await getDoc('users', req.user.uid || req.user.id);
        const businessInfo = user?.businessInfo || {};
        const companyName = businessInfo.companyName || user?.companyName || 'Your Company';

        // Generate work order HTML
        const itemsHtml = (workOrder.items || []).map(item => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHTML(item.name || item.description || 'Item')}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${Number(item.price || 0).toFixed(2)}</td>
            </tr>
        `).join('');

        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
                    table { width: 100%; border-collapse: collapse; background: white; margin: 20px 0; }
                    th { background: #4f46e5; color: white; padding: 10px; text-align: left; }
                    td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
                    .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0;">Work Order</h1>
                        <p style="margin: 10px 0 0 0;">#${workOrder.workOrderNumber || workOrder.id}</p>
                    </div>
                    <div class="content">
                        ${message ? `<p style="white-space: pre-line;">${escapeHTML(message)}</p><hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">` : ''}
                        
                        <h3>Work Order Details</h3>
                        <p><strong>Client:</strong> ${escapeHTML(workOrder.clientName || 'N/A')}</p>
                        <p><strong>Address:</strong> ${escapeHTML(workOrder.address || 'N/A')}</p>
                        <p><strong>Status:</strong> ${escapeHTML(workOrder.status || 'Draft')}</p>
                        ${workOrder.scheduledDate ? `<p><strong>Scheduled:</strong> ${new Date(workOrder.scheduledDate).toLocaleDateString()}</p>` : ''}
                        
                        ${workOrder.title ? `<h3>Title</h3><p>${escapeHTML(workOrder.title)}</p>` : ''}
                        ${workOrder.description ? `<h3>Description</h3><p>${escapeHTML(workOrder.description)}</p>` : ''}
                        
                        ${workOrder.items && workOrder.items.length > 0 ? `
                        <h3>Items</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th style="text-align: right;">Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>
                        <div class="total">Total: $${Number(workOrder.price || workOrder.totalAmount || 0).toFixed(2)}</div>
                        ` : ''}
                    </div>
                </div>
            </body>
            </html>
        `;

        // Send email using email service
        // const { sendEmail } = require(path.join(__dirname, "..", "utils", "emailService"));

        const result = await sendEmail({
            to: to,
            subject: `Work Order ${workOrder.workOrderNumber || workOrder.id}${companyName ? ` from ${companyName}` : ''}`,
            html: emailHtml,
            userSmtpConfig: user?.smtpConfig || null
        });

        if (result.success) {
            res.json({
                success: true,
                message: "Work order sent successfully!",
                messageId: result.messageId
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error || "Failed to send work order email"
            });
        }
    } catch (error) {
        console.error('Error sending work order email:', error);
        res.status(500).json({ error: 'Failed to send work order email' });
    }
});

module.exports = router;
