const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const { requireSuperAdmin, stepUpRequired } = require('../middleware/authorize');
const platformService = require('../utils/PlatformService');
const webhookService = require('../utils/WebhookService');
const businessService = require('../utils/BusinessService');
const planService = require('../utils/PlanService');

// All platform routes require Super Admin Authentication
// However, some impersonation control routes need to be accessible during impersonation
router.use(authRequired);

// 🔍 IMPERSONATION STATUS & CONTROL
// (Must be BEFORE requireSuperAdmin because impersonating suppresses isSuperAdmin bit)
router.get('/auth/impersonation-status', (req, res) => {
    res.json({
        isImpersonating: !!req.session.impersonateUserId,
        targetUserId: req.session.impersonateUserId,
        targetUserEmail: req.session.impersonateUserEmail
    });
});

router.post('/auth/stop-impersonation', (req, res) => {
    if (req.session.impersonateUserId) {
        const adminId = req.session.userId;
        const targetId = req.session.impersonateUserId;

        delete req.session.impersonateUserId;
        delete req.session.impersonateUserEmail;

        req.session.save((err) => {
            if (err) return res.status(500).json({ error: "Failed to save session" });
            console.log(`[Impersonation] Admin ${adminId} stopped impersonating ${targetId}`);
            res.json({ success: true, message: "Impersonation stopped" });
        });
        return;
    }
    res.status(400).json({ error: "Not currently impersonating" });
});

// Everything below this point requires full Super Admin status
router.use(requireSuperAdmin);

/**
 * 🔐 AUTH & MFA
 */

// Generate MFA Setup (Secret + QR Code)
router.get('/auth/mfa/setup', async (req, res) => {
    try {
        const { qrCodeUrl, secret } = await platformService.setupMFA(req.user.uid);
        res.json({ qrCodeUrl, secret });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate MFA setup' });
    }
});

// Verify MFA Code
router.post('/auth/mfa/verify', async (req, res) => {
    const { token } = req.body;
    try {
        const isValid = await platformService.verifyMFA(req.user.uid, token);
        if (isValid) {
            // Update session to reflect MFA verification
            if (req.session) {
                req.session.mfaVerifiedAt = new Date().toISOString();
            }
            await platformService.logAction(req.user.uid, 'MFA_VERIFIED', null, { ip: req.ip });
            return res.json({ success: true });
        }
        res.status(401).json({ error: 'Invalid MFA token' });
    } catch (error) {
        res.status(500).json({ error: 'MFA verification failed' });
    }
});

/**
 * 📊 METRICS & LISTS
 */

router.get('/metrics', async (req, res) => {
    try {
        const metrics = await platformService.getPlatformMetrics();
        res.json(metrics);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

router.get('/tenants', async (req, res) => {
    try {
        const tenants = await businessService.getAllBusinesses();
        res.json({ data: tenants });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tenants' });
    }
});

router.get('/tenants/:id', async (req, res) => {
    try {
        const tenant = await businessService.getBusinessById(req.params.id);
        const admins = await businessService.getBusinessAdmins(req.params.id);
        res.json({ ...tenant, admins });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tenant details' });
    }
});

/**
 * 🛠️ TENANT LIFECYCLE (Sensitive - Needs Step-up)
 */

router.post('/tenants/:id/approve', stepUpRequired, async (req, res) => {
    try {
        const { permissions } = req.body;
        await businessService.approveBusiness(req.params.id, req.user.uid, permissions);
        await platformService.logAction(req.user.uid, 'TENANT_APPROVE', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/tenants/:id/suspend', stepUpRequired, async (req, res) => {
    try {
        const { reason } = req.body;
        await platformService.updateTenantStatus(req.user.uid, req.params.id, 'suspended', reason);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/tenants/:id/unsuspend', stepUpRequired, async (req, res) => {
    try {
        await platformService.updateTenantStatus(req.user.uid, req.params.id, 'active', 'Admin reinstated');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 💳 SUBSCRIPTION PLANS
 */

// Get all plans
router.get('/plans', async (req, res) => {
    try {
        const plans = await planService.getAllPlans();
        res.json({ data: plans });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
});

// Seed default plans (if empty)
router.post('/plans/seed', async (req, res) => {
    try {
        await planService.seedDefaultPlans();
        res.json({ success: true, message: 'Default plans seeded' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to seed plans' });
    }
});

// Assign plan to tenant (Sensitive - Step-up)
router.post('/tenants/:id/plan', stepUpRequired, async (req, res) => {
    try {
        const { planId } = req.body;
        await planService.assignPlanToTenant(req.user.uid, req.params.id, planId);
        await platformService.logAction(req.user.uid, 'TENANT_PLAN_CHANGE', req.params.id, { planId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 🕵️ SUPPORT TOOLS (Sensitive)
 */

// Impersonate Tenant Owner
router.post('/tenants/:id/impersonate', stepUpRequired, async (req, res) => {
    try {
        const tenantId = req.params.id;
        const business = await businessService.getBusinessById(tenantId);

        if (!business) return res.status(404).json({ error: "Tenant not found" });
        if (!business.ownerId) return res.status(400).json({ error: "Tenant has no owner assigned" });

        const owner = await getDoc('users', business.ownerId);
        if (!owner) return res.status(404).json({ error: "Owner account not found" });

        // Set impersonation in session
        req.session.impersonateUserId = owner.uid || owner.id;
        req.session.impersonateUserEmail = owner.email;

        await platformService.logAction(req.user.uid, 'USER_IMPERSONATION_START', tenantId, {
            targetUserId: owner.id,
            targetUserEmail: owner.email
        });

        req.session.save((err) => {
            if (err) return res.status(500).json({ error: "Failed to save session" });
            res.json({
                success: true,
                message: `Now impersonating ${owner.email}`,
                targetUrl: '/dashboard'
            });
        });
    } catch (error) {
        console.error('Impersonation Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Platform Audit Logs
router.get('/audit-logs', async (req, res) => {
    try {
        const logs = await platformService.getAuditLogs(50); // Fetch last 50
        res.json({ data: logs });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// Platform Webhooks Explorer
router.get('/webhooks', async (req, res) => {
    try {
        const logs = await webhookService.getRecentWebhooks(50);
        res.json({ data: logs });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch webhook logs' });
    }
});

// Platform Billing Ledger
router.get('/billing/transactions', async (req, res) => {
    try {
        const transactions = await platformService.getBillingTransactions(100);
        res.json({ data: transactions });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch billing ledger' });
    }
});

// Platform Alerts
router.get('/alerts', async (req, res) => {
    try {
        const alerts = await platformService.getSystemAlerts();
        res.json({ data: alerts });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch system alerts' });
    }
});

module.exports = router;
