const express = require("express");
const path = require("path");
const crypto = require("crypto");
const formService = require("../utils/FormService");
const defaultTemplates = require("../data/defaultFormTemplates");
const { validateRequest, formSchema } = require('../utils/validation');
const { authorize, requireAdmin } = require('../middleware/authorize');
const auditService = require('../utils/EnhancedAuditService');

const router = express.Router();

// Middleware-like helper for permissions
async function getFormsPermissionContext(req) {
  const userId = req.user?.uid || req.user?.id;
  if (!userId) throw new Error('Not authenticated');

  if (!req.formPermissionContext || req.formPermissionContext.userId !== userId) {
    req.formPermissionContext = await formService.getFormAccessContext(userId);
  }
  return req.formPermissionContext;
}

// Templates
router.get("/templates", authorize(['staff']), async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) return res.status(403).json({ error: 'Business context required' });
    const userTemplates = await formService.getCustomTemplates(businessId);
    res.json([...defaultTemplates, ...userTemplates]);
  } catch (error) {
    res.status(500).json({ error: "Failed to load templates" });
  }
});

router.post("/templates", requireAdmin, async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) return res.status(403).json({ error: 'Business context required' });
    const template = await formService.saveCustomTemplate(businessId, req.body);
    auditService.log(req, 'formTemplate.created', 'formTemplate', template.id, {}, { name: template.title }).catch(() => { });
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: "Failed to save template" });
  }
});

router.delete("/templates/:templateId", requireAdmin, async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) return res.status(403).json({ error: 'Business context required' });
    await formService.deleteTemplate(req.params.templateId, businessId);
    auditService.log(req, 'formTemplate.deleted', 'formTemplate', req.params.templateId).catch(() => { });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Forms CRUD
router.get("/", authorize(['staff']), async (req, res) => {
  try {
    const ctx = await getFormsPermissionContext(req);
    if (ctx.business && !ctx.hasFormsPermission) return res.status(403).json({ error: "Access denied" });

    const businessId = ctx.business?.id || ctx.userId;
    const forms = await formService.getForms(businessId);
    res.json(forms);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch forms" });
  }
});

// Get forms where user has pending invitations or is a member
router.get("/invited", async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { email } = await formService.getUserById(userId);

    // Fetch both pending invites by email and existing memberships by userId
    const [invites, memberships] = await Promise.all([
      formService.getInvitedForms(email),
      formService.getMemberships(userId)
    ]);

    res.json({
      pending: invites,
      active: memberships
    });
  } catch (error) {
    console.error('Error fetching invited forms:', error);
    res.status(500).json({ error: "Failed to fetch invited forms" });
  }
});

router.get("/:id", authorize(['staff']), async (req, res) => {
  try {
    const form = await formService.getFormById(req.params.id);
    if (!form) return res.status(404).json({ error: "Form not found" });

    const ctx = await getFormsPermissionContext(req);
    const businessId = ctx.business?.id || ctx.userId;
    if (form.businessId !== businessId && !ctx.allowedUserIds.has(form.userId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(form);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch form" });
  }
});

router.post("/", authorize(['staff']), validateRequest(formSchema), async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    const ctx = await getFormsPermissionContext(req);
    if (ctx.business && !ctx.hasFormsPermission) return res.status(403).json({ error: "Access denied" });

    const form = await formService.createForm(req.body, userId, ctx.formsOwnerId, ctx.business?.id);
    auditService.log(req, 'form.created', 'form', form.id, {}, { title: form.title }).catch(() => { });
    res.status(201).json(form);
  } catch (error) {
    res.status(500).json({ error: "Failed to create form" });
  }
});

router.put("/:id", authorize(['staff']), validateRequest(formSchema), async (req, res) => {
  try {
    const ctx = await getFormsPermissionContext(req);
    const businessId = ctx.business?.id || ctx.userId;
    const updated = await formService.updateForm(req.params.id, businessId, req.body);
    auditService.log(req, 'form.updated', 'form', req.params.id, {}, { title: updated.title }).catch(() => { });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update form" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const ctx = await getFormsPermissionContext(req);
    const businessId = ctx.business?.id || ctx.userId;
    await formService.deleteForm(req.params.id, businessId);
    auditService.log(req, 'form.deleted', 'form', req.params.id).catch(() => { });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete form" });
  }
});

// Members & Invites
router.get("/:id/members", async (req, res) => {
  try {
    const ctx = await getFormsPermissionContext(req);
    const form = await formService.getFormById(req.params.id);
    if (!form || (form.businessId !== ctx.business?.id && form.userId !== ctx.userId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const members = await formService.getFormMembers(req.params.id);
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

router.get("/:id/invites", async (req, res) => {
  try {
    const ctx = await getFormsPermissionContext(req);
    const form = await formService.getFormById(req.params.id);
    if (!form || (form.businessId !== ctx.business?.id && form.userId !== ctx.userId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const invites = await formService.getFormInvites(req.params.id);
    res.json(invites);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch invites" });
  }
});

router.post("/:id/invites", async (req, res) => {
  try {
    const ctx = await getFormsPermissionContext(req);
    const form = await formService.getFormById(req.params.id);
    if (!form || (form.businessId !== ctx.business?.id && form.userId !== ctx.userId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const invite = await formService.createInvite(req.params.id, req.body);
    const owner = await formService.getUserById(form.userId);

    const { sendEmail } = require('../utils/emailService');
    const appUrl = process.env.APP_URL || 'http://localhost:4000';
    const acceptUrl = `${appUrl}/accept-invite/${invite.token}`;

    await sendEmail({
      to: invite.email,
      subject: `Invite: ${form.title}`,
      html: `<a href="${acceptUrl}">Accept Invitation</a>`,
      userSmtpConfig: owner?.smtpConfig
    });
    res.json(invite);
  } catch (e) { res.status(500).json({ error: "Failed to create invite" }); }
});

router.post("/invites/:inviteId/accept", async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    const user = await formService.getUserById(userId);
    const result = await formService.acceptInvite(req.params.inviteId, userId, user.email);
    res.json({ success: true, formId: result.formId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
module.exports.getFormById = (id) => formService.getFormById(id);
