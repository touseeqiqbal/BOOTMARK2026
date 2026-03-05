# BOOTMARK Platform Integrations & Webhook Pipeline

This document details the architecture for external service integrations, specifically for data ingestion and billing monitoring.

## 1. Webhook Ingestion Pipeline
The platform uses a unified, diagnostic-first ingestion layer for handling external events (e.g., QuickBooks updates, Authorize.net notifications).

### Ingestion Flow
1. **Public Endpoint**: `/api/webhooks/:provider` (e.g., `/api/webhooks/quickbooks`).
2. **Diagnostic Log**: The `WebhookService.logWebhook` method is called IMMEDIATELY. This saves the raw payload and headers to the `webhooks` collection in Firestore.
3. **Immutability**: Once logged, the webhook record is immutable. Even if the signature or processing fails, the request is captured for admin inspection.
4. **Status Updates**: After processing, the service updates the `webhooks` record with a `success` or `error` status.

### Troubleshooting (Webhook Explorer)
- Super Admins can access the **Webhook Explorer** to view every incoming request.
- This allows for debugging of mismatched payloads, invalid signatures, or tenant mapping failures without looking at server logs.

## 2. Platform Billing Ledger
The Super Admin panel provides a centralized view of financial health across all business nodes.

### Data Source
- **Collection**: `paymentAttempts`.
- **Logic**: Every time a payment is attempted via `Authorize.net` (handled by `PaymentService`), a diagnostic record is created.
- **Aggregation**: The Super Admin **Billing Ledger** fetches these records globally, providing a "single pane of glass" for all transactions.

### Multi-Tenant Mapping
- Every `paymentAttempt` includes a `businessId` and `planId`, allowing the platform to calculate Monthly Recurring Revenue (MRR) and plan distribution metrics dynamically.

## 3. Extending the Platform
To add a new external provider (e.g., Stripe, Shopify):
1. Create a new endpoint in `routes/webhooks.js`.
2. Register the provider-specific logic (e.g., signature verification).
3. Use `webhookService.logWebhook('provider_name', ...)` at the start of the handler.
4. Add the provider ID to the **Webhook Explorer** filters if necessary.

## 4. Key Security Rules
- **webhooks**: Restricted to backend-only access.
- **paymentAttempts**: Restricted to backend-only access.
- **platformAuditLogs**: Restricted to Super Admin `read` only.
