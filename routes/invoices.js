const express = require("express");
const invoiceService = require("../utils/InvoiceService");
const { getDoc, deleteDoc, setDoc, getCollectionRef } = require("../utils/db");
const { validateRequest, invoiceSchema } = require("../utils/validation");
const { authorize, requireAdmin } = require("../middleware/authorize");
const metricsService = require("../utils/MetricsService");
const auditService = require("../utils/EnhancedAuditService");

const router = express.Router();

// ============================================
// INVOICE SETTINGS
// ============================================

// Get invoice settings
router.get('/settings', authorize(['staff']), async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) return res.status(403).json({ error: 'Business context required' });
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID is required' });
    }

    let settings = await getDoc('invoiceSettings', businessId);

    // Return default settings if none exist
    if (!settings) {
      settings = {
        businessId,
        prefix: 'INV-',
        nextNumber: 1001,
        defaultTaxRate: 0,
        defaultTerms: '',
        defaultNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching invoice settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update invoice settings
router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID is required' });
    }

    const { prefix, nextNumber, defaultTaxRate, defaultTerms, defaultNotes } = req.body;

    const settings = {
      prefix: prefix || 'INV-',
      nextNumber: nextNumber || 1001,
      defaultTaxRate: defaultTaxRate || 0,
      defaultTerms: defaultTerms || '',
      defaultNotes: defaultNotes || '',
      businessId,
      updatedAt: new Date().toISOString()
    };

    // Preserve creation date
    const existing = await getDoc('invoiceSettings', businessId);
    if (existing && existing.createdAt) {
      settings.createdAt = existing.createdAt;
    } else {
      settings.createdAt = new Date().toISOString();
    }

    await setDoc('invoiceSettings', businessId, settings);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating invoice settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET all invoices (PAGINATED & LIMITED)
router.get("/", authorize(['staff']), async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    const limit = parseInt(req.query.limit) || 20;
    const lastVisibleId = req.query.lastVisibleId;

    if (!businessId) {
      return res.status(403).json({ error: 'Business ID required' });
    }

    let query = getCollectionRef('invoices')
      .where('businessId', '==', businessId)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    // Filter by status if provided (NOTE: This might require a compound index)
    if (req.query.status) {
      query = query.where('status', '==', req.query.status);
    }

    if (lastVisibleId) {
      const lastDoc = await getCollectionRef('invoices').doc(lastVisibleId).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    const invoices = [];
    snapshot.forEach(doc => {
      invoices.push({ id: doc.id, ...doc.data() });
    });

    res.json({
      data: invoices,
      lastId: invoices.length > 0 ? invoices[invoices.length - 1].id : null,
      hasMore: invoices.length === limit,
      total: invoices.length // Note: exact total requires a separate count query or metadata
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

router.get("/:id", authorize(['staff']), async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) return res.status(403).json({ error: "Access denied" });

    const invoice = await invoiceService.getInvoiceById(req.params.id);
    if (!invoice || invoice.businessId !== businessId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(invoice);
  } catch (error) {
    console.error(`Error fetching invoice ${req.params.id}:`, error);
    res.status(500).json({ error: "Failed to fetch invoice details" });
  }
});

router.post("/", authorize(['staff']), validateRequest(invoiceSchema), async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) return res.status(403).json({ error: "Access denied" });

    const invoice = await invoiceService.createInvoice(businessId, req.body);

    // Update metrics
    const month = new Date().toISOString().slice(0, 7);
    metricsService.incrementCounter(businessId, 'invoice_count', 1).catch(() => { });
    metricsService.updateRevenueMetric(businessId, month, invoice.total || 0, 'created').catch(() => { });

    // Audit log
    auditService.log(req, 'invoice.created', 'invoice', invoice.id, {
      status: { old: null, new: invoice.status || 'draft' },
      total: { old: null, new: invoice.total }
    }).catch(() => { });

    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", authorize(['staff']), validateRequest(invoiceSchema), async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) return res.status(403).json({ error: "Access denied" });

    // Get before state for audit diff
    const before = await getDoc('invoices', req.params.id);
    const updated = await invoiceService.updateInvoice(req.params.id, businessId, req.body);

    // Audit log with diff
    if (before) {
      const diff = auditService.computeDiff(before, updated, ['status', 'total', 'dueDate', 'lineItems']);
      auditService.log(req, 'invoice.updated', 'invoice', req.params.id, diff).catch(() => { });

      // If payment status changed, update revenue metric
      if (req.body.status === 'paid' && before.status !== 'paid') {
        const month = new Date().toISOString().slice(0, 7);
        metricsService.updateRevenueMetric(businessId, month, updated.total || 0, 'paid').catch(() => { });
      }
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(403).json({ error: 'Business ID required' });
    }

    // CRITICAL: Verify ownership before deletion to prevent cross-tenant data access
    const invoice = await getDoc('invoices', req.params.id);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.businessId !== businessId) {
      console.warn(`[Security] Unauthorized deletion attempt: User ${req.user?.id} tried to delete invoice ${req.params.id} belonging to business ${invoice.businessId}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    await deleteDoc('invoices', req.params.id);

    // Update metrics
    const month = invoice.createdAt ? invoice.createdAt.slice(0, 7) : new Date().toISOString().slice(0, 7);
    metricsService.incrementCounter(businessId, 'invoice_count', -1).catch(() => { });
    metricsService.updateRevenueMetric(businessId, month, invoice.total || 0, 'deleted').catch(() => { });

    // Audit log
    auditService.log(req, 'invoice.deleted', 'invoice', req.params.id, {
      status: { old: invoice.status, new: null },
      total: { old: invoice.total, new: null }
    }).catch(() => { });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: "Failed to delete invoice" });
  }
});

router.post("/:id/send", authorize(['staff']), async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) return res.status(403).json({ error: 'Business context required' });
    const result = await invoiceService.sendInvoiceEmail(req.params.id, businessId, req.body);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
