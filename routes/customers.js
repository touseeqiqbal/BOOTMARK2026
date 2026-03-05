const express = require("express");
const customerService = require("../utils/CustomerService");
const router = express.Router();
const { getDoc, setDoc } = require("../utils/db");
const { validateRequest, customerSchema } = require("../utils/validation");
const { sendEmail } = require("../utils/emailService");
const { authorize, requireAdmin } = require("../middleware/authorize");
const metricsService = require("../utils/MetricsService");
const auditService = require("../utils/EnhancedAuditService");

async function sendClientInvitation(customer, token) {
  const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invite?token=${token}`;
  const { escapeHTML } = require("../utils/htmlSanitizer");
  const subject = `Invitation to Client Portal`;
  const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Welcome, ${escapeHTML(customer.name)}!</h2>
            <p>You have been invited to access the client portal.</p>
            <p>Please click the button below to accept the invitation and set up your account:</p>
            <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">
                Accept Invitation
            </a>
            <p style="margin-top: 20px; color: #666; font-size: 12px;">If the button doesn't work, copy and paste this link: ${link}</p>
        </div>
    `;

  // In dev mode, log the link for easier testing
  if (process.env.NODE_ENV !== 'production') {
    console.log('--- CLIENT INVITATION LINK ---');
    console.log(link);
    console.log('------------------------------');
  }

  try {
    await sendEmail({
      to: customer.email,
      subject,
      html
    });
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    // Don't throw, just log. The token is set in DB anyway.
  }
}

// ============================================
// CUSTOMER SETTINGS (CLIENT SETTINGS)
// ============================================

// Get customer settings
router.get('/settings', authorize(['staff']), async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(403).json({ error: 'Business context required' });
    }

    let settings = await getDoc('customerSettings', businessId);

    // Return default settings if none exist
    if (!settings) {
      settings = {
        businessId,
        nextNumber: 1001, // If auto-numbering clients matters
        defaultCity: '',
        defaultState: '',
        defaultZip: '',
        defaultCountry: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching customer settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update customer settings
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

    await setDoc('customerSettings', businessId, settings);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating customer settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});


// GET all customers (PAGINATED)
router.get("/", authorize(['staff']), async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(403).json({ error: 'Business ID required' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const lastId = req.query.lastId || null;

    const customers = await customerService.getCustomersByBusinessId(businessId, limit, lastId);

    res.json({
      data: customers,
      lastId: customers.length > 0 ? customers[customers.length - 1].id : null,
      hasMore: customers.length === limit
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

router.post("/", authorize(['staff']), validateRequest(customerSchema), async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) return res.status(403).json({ error: 'Business context required' });
    const customer = await customerService.createCustomer(businessId, req.body);

    metricsService.updateClientCount(businessId, 1).catch(() => { });
    auditService.log(req, 'client.created', 'customer', customer.id, {
      name: { old: null, new: customer.name }
    }).catch(() => { });

    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/:id", authorize(['staff']), async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) return res.status(403).json({ error: 'Business context required' });
    const customer = await customerService.getCustomerById(req.params.id);
    if (!customer || customer.businessId !== businessId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: "Failed" });
  }
});

router.put("/:id", authorize(['staff']), validateRequest(customerSchema), async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) return res.status(403).json({ error: 'Business context required' });
    const updated = await customerService.updateCustomer(req.params.id, businessId, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) return res.status(403).json({ error: 'Business context required' });
    await customerService.deleteCustomer(req.params.id, businessId);

    metricsService.updateClientCount(businessId, -1).catch(() => { });
    auditService.log(req, 'client.deleted', 'customer', req.params.id).catch(() => { });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed" });
  }
});

module.exports = {
  router,
  extractCustomerInfo: (f, s) => customerService.extractCustomerInfo(f, s),
  getCustomers: (uid) => customerService.getCustomersByUserId(uid),
  saveCustomers: async (customers) => {
    const { setDoc } = require('../utils/db');
    for (const c of customers) await setDoc('customers', c.id, c);
  },
  sendClientInvitation
};
