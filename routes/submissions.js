const express = require("express");
const submissionService = require("../utils/SubmissionService");
const formService = require("../utils/FormService");
const customerService = require("../utils/CustomerService");
const invoiceService = require("../utils/InvoiceService");
const { buildInvoiceFromSubmission } = require("../utils/invoiceGenerator");
const { authorize, requireAdmin } = require('../middleware/authorize');
const { validateRequest, submissionCreateSchema } = require('../utils/validation');

const router = express.Router();

router.get("/", authorize(['staff']), async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ error: "Business context required" });
    }

    const limit = parseInt(req.query.limit) || 50;
    const lastId = req.query.lastId || null;

    const submissions = await submissionService.getSubmissionsByBusinessId(businessId, limit, lastId);

    res.json({
      data: submissions,
      lastId: submissions.length > 0 ? submissions[submissions.length - 1].id : null,
      hasMore: submissions.length === limit
    });
  } catch (error) {
    console.error("Fetch submissions error:", error);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

router.get("/form/:formId", authorize(['staff']), async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    const { formId } = req.params;

    // 1. Verify access to the Form
    const form = await formService.getFormById(formId);
    if (!form) {
      return res.status(404).json({ error: "Form not found" });
    }

    if (businessId && form.businessId !== businessId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // 2. Fetch submissions
    const submissions = await submissionService.getSubmissionsByFormId(formId);
    res.json(submissions);
  } catch (error) {
    console.error("Fetch form submissions error:", error);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const businessId = req.user?.businessId;
    const submissionId = req.params.id;

    // 1. Get submission to find formId
    const submission = await submissionService.getSubmissionById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    // 2. Get form to verify business ownership
    const form = await formService.getFormById(submission.formId);
    if (form && businessId && form.businessId !== businessId) {
      return res.status(403).json({ error: "Access denied" });
    }

    await submissionService.deleteSubmission(submissionId);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete submission error:", error);
    res.status(500).json({ error: "Failed to delete submission" });
  }
});

router.post("/:formId/entries", authorize(['staff']), validateRequest(submissionCreateSchema), async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    const form = await formService.getFormById(req.params.formId);
    if (!form) return res.status(404).json({ error: "Form not found" });

    const submission = await submissionService.createSubmission({
      formId: form.id,
      businessId: form.businessId,
      data: req.body.data,
      submittedBy: userId,
      submittedVia: 'internal-entry'
    });

    const { customerName, customerEmail } = customerService.extractCustomerInfo(form, req.body.data);
    if (customerName || customerEmail) {
      // Further customer logic could be service-ified too
    }

    res.json({ success: true, submission });
  } catch (e) { res.status(500).json({ error: "Failed" }); }
});

module.exports = router;
