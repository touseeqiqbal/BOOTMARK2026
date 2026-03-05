const express = require("express");
const router = express.Router();
const webhookService = require("../utils/WebhookService");

/**
 * Public Webhook Ingestion
 * All external webhooks (QB, Authorize.net) should hit these endpoints.
 * They are logged immediately for troubleshooting before processing.
 */

// Test Webhook (for verification)
router.post("/test", async (req, res) => {
    try {
        const logId = await webhookService.logWebhook('test', req.body, req.headers);
        await webhookService.updateStatus(logId, 'success');
        res.json({ success: true, logId });
    } catch (error) {
        res.status(500).json({ error: 'Failed to log test webhook' });
    }
});

// QuickBooks Webhook
router.post("/quickbooks", async (req, res) => {
    let logId;
    try {
        logId = await webhookService.logWebhook('quickbooks', req.body, req.headers);

        // TODO: Implement actual QuickBooks signature verification logic here
        // For now, we log and return success to the provider

        await webhookService.updateStatus(logId, 'received');
        res.status(200).send('Webhook received');
    } catch (error) {
        if (logId) await webhookService.updateStatus(logId, 'error', error.message);
        res.status(500).send('Internal Server Error');
    }
});

// Authorize.net Webhook
router.post("/authorizenet", async (req, res) => {
    let logId;
    try {
        logId = await webhookService.logWebhook('authorizenet', req.body, req.headers);

        // TODO: Implement Authorize.net event handling (e.g., net.authorize.payment.authcapture.created)

        await webhookService.updateStatus(logId, 'received');
        res.status(200).send('Webhook received');
    } catch (error) {
        if (logId) await webhookService.updateStatus(logId, 'error', error.message);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
