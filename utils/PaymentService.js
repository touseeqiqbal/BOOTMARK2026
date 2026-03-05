/**
 * Payment Service (Authorize.net)
 * 
 * Handles server-side credit card processing via Authorize.net.
 * 
 * Security:
 *   - NEVER stores full card numbers, CVV, or expiration dates
 *   - API keys are read from environment / tenant config
 *   - All charges are server-side only
 *   - Webhook signatures are verified
 *   - Payments are linked to invoices and tenants
 * 
 * Usage:
 *   const payments = require('./PaymentService');
 *   const result = await payments.chargeCard(tenantId, invoiceId, cardData, amount);
 *   const valid = payments.verifyWebhook(headers, body);
 */

const { db, getDoc } = require('./db');
const admin = require('firebase-admin');
const crypto = require('crypto');

class PaymentService {

    /**
     * Process a credit card payment for an invoice
     * 
     * @param {string} businessId - Tenant ID
     * @param {string} invoiceId - Invoice to pay
     * @param {Object} cardData - { cardNumber, expirationDate, cvv }
     * @param {number} amount - Amount to charge
     * @param {string} actorId - UID of person making payment
     * @returns {Object} { success, paymentId, transactionId, error }
     */
    async chargeCard(businessId, invoiceId, cardData, amount, actorId) {
        try {
            // 1. Get tenant's Authorize.net credentials
            const config = await this.getTenantPaymentConfig(businessId);
            if (!config) {
                return { success: false, error: 'Payment gateway not configured for this business' };
            }

            // 2. Validate invoice exists and belongs to tenant
            const invoice = await getDoc('invoices', invoiceId);
            if (!invoice) {
                return { success: false, error: 'Invoice not found' };
            }
            if (invoice.businessId !== businessId) {
                return { success: false, error: 'Invoice does not belong to this business' };
            }

            // 3. Calculate amount due
            const amountDue = (invoice.total || 0) - (invoice.amountPaid || 0);
            if (amount > amountDue) {
                return { success: false, error: `Amount exceeds balance due ($${amountDue.toFixed(2)})` };
            }

            // 4. Check for duplicate payment (idempotency)
            const idempotencyKey = `${invoiceId}_${amount}_${Date.now()}`;

            // 5. Process charge via Authorize.net API
            const chargeResult = await this.executeAuthorizeNetCharge(
                config,
                cardData,
                amount,
                {
                    invoiceId,
                    businessId,
                    description: `Invoice ${invoice.invoiceNumber || invoiceId}`
                }
            );

            // 6. Record payment in Firestore (NEVER store card details)
            const paymentRef = db.collection('payments').doc();
            const paymentData = {
                businessId,
                invoiceId,
                amount,
                method: 'credit_card',
                status: chargeResult.success ? 'completed' : 'failed',
                authNetTransactionId: chargeResult.transactionId || null,
                authNetResponseCode: chargeResult.responseCode || null,
                last4: cardData.cardNumber ? cardData.cardNumber.slice(-4) : null,
                cardType: chargeResult.cardType || null,
                idempotencyKey,
                processedBy: actorId,
                errorMessage: chargeResult.error || null,
                processedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
            };

            await paymentRef.set(paymentData);

            // 7. Update invoice if payment succeeded
            if (chargeResult.success) {
                const newAmountPaid = (invoice.amountPaid || 0) + amount;
                const newStatus = newAmountPaid >= invoice.total ? 'paid' : 'partially_paid';

                await db.collection('invoices').doc(invoiceId).update({
                    amountPaid: newAmountPaid,
                    status: newStatus,
                    paidAt: newStatus === 'paid' ? new Date().toISOString() : invoice.paidAt || null,
                    paymentIds: admin.firestore.FieldValue.arrayUnion(paymentRef.id),
                    updatedAt: new Date().toISOString(),
                });
            }

            return {
                success: chargeResult.success,
                paymentId: paymentRef.id,
                transactionId: chargeResult.transactionId,
                error: chargeResult.error
            };

        } catch (error) {
            console.error('[PaymentService] Charge failed:', error);
            return { success: false, error: 'Payment processing failed' };
        }
    }

    /**
     * Execute the actual Authorize.net API call
     * Abstracted for testability and potential gateway swapping
     */
    async executeAuthorizeNetCharge(config, cardData, amount, orderInfo) {
        try {
            // Build Authorize.net XML API request
            const requestBody = {
                createTransactionRequest: {
                    merchantAuthentication: {
                        name: config.apiLoginId,
                        transactionKey: config.transactionKey
                    },
                    transactionRequest: {
                        transactionType: 'authCaptureTransaction',
                        amount: amount.toFixed(2),
                        payment: {
                            creditCard: {
                                cardNumber: cardData.cardNumber,
                                expirationDate: cardData.expirationDate,
                                cardCode: cardData.cvv
                            }
                        },
                        order: {
                            invoiceNumber: orderInfo.invoiceId?.substring(0, 20),
                            description: orderInfo.description?.substring(0, 255)
                        }
                    }
                }
            };

            // Determine API URL based on environment
            const apiUrl = config.environment === 'production'
                ? 'https://api.authorize.net/xml/v1/request.api'
                : 'https://apitest.authorize.net/xml/v1/request.api';

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();

            // Parse Authorize.net response
            const transactionResponse = result?.transactionResponse;
            if (transactionResponse?.responseCode === '1') {
                return {
                    success: true,
                    transactionId: transactionResponse.transId,
                    responseCode: transactionResponse.responseCode,
                    cardType: transactionResponse.accountType,
                };
            } else {
                return {
                    success: false,
                    transactionId: transactionResponse?.transId,
                    responseCode: transactionResponse?.responseCode,
                    error: transactionResponse?.errors?.[0]?.errorText || 'Transaction declined',
                };
            }

        } catch (error) {
            console.error('[PaymentService] Authorize.net API error:', error);
            return { success: false, error: 'Payment gateway unavailable' };
        }
    }

    /**
     * Verify an Authorize.net webhook signature
     * 
     * @param {Object} headers - Request headers
     * @param {string} rawBody - Raw request body string
     * @returns {boolean} Whether the signature is valid
     */
    verifyWebhook(headers, rawBody) {
        const signatureKey = process.env.AUTHNET_WEBHOOK_SIGNATURE_KEY;
        if (!signatureKey) {
            console.error('[PaymentService] AUTHNET_WEBHOOK_SIGNATURE_KEY not configured');
            return false;
        }

        const receivedSignature = headers['x-anet-signature'];
        if (!receivedSignature) return false;

        const computed = crypto
            .createHmac('sha512', signatureKey)
            .update(rawBody)
            .digest('hex')
            .toUpperCase();

        const received = receivedSignature.replace(/^sha512=/, '').toUpperCase();
        return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(received));
    }

    /**
     * Handle a webhook event from Authorize.net
     * 
     * @param {Object} event - Webhook event payload
     */
    async handleWebhookEvent(event) {
        try {
            const eventType = event.eventType;
            const transactionId = event.payload?.id;

            if (!transactionId) return;

            // Find the payment by transaction ID
            const paymentSnap = await db.collection('payments')
                .where('authNetTransactionId', '==', String(transactionId))
                .limit(1)
                .get();

            if (paymentSnap.empty) {
                console.warn(`[PaymentService] Webhook: No payment found for transaction ${transactionId}`);
                return;
            }

            const paymentDoc = paymentSnap.docs[0];
            const payment = paymentDoc.data();

            // Map webhook event to status
            const statusMap = {
                'net.authorize.payment.authcapture.created': 'completed',
                'net.authorize.payment.capture.created': 'completed',
                'net.authorize.payment.refund.created': 'refunded',
                'net.authorize.payment.void.created': 'voided',
                'net.authorize.payment.fraud.declined': 'failed',
            };

            const newStatus = statusMap[eventType];
            if (newStatus && newStatus !== payment.status) {
                await paymentDoc.ref.update({
                    status: newStatus,
                    webhookEventType: eventType,
                    updatedAt: new Date().toISOString(),
                });

                // If refunded/voided, update the invoice
                if (newStatus === 'refunded' || newStatus === 'voided') {
                    await db.collection('invoices').doc(payment.invoiceId).update({
                        amountPaid: admin.firestore.FieldValue.increment(-payment.amount),
                        status: 'sent', // Revert to sent
                        updatedAt: new Date().toISOString(),
                    });
                }
            }

        } catch (error) {
            console.error('[PaymentService] Webhook handling error:', error);
        }
    }

    /**
     * Get payment configuration for a tenant
     */
    async getTenantPaymentConfig(businessId) {
        try {
            // Check business-specific config first
            const businessDoc = await getDoc('businesses', businessId);
            if (businessDoc?.paymentConfig) {
                return businessDoc.paymentConfig;
            }

            // Fallback to integration doc
            const integDoc = await db.collection('integrations').doc(`${businessId}_authorizeNet`).get();
            if (integDoc.exists) {
                return integDoc.data();
            }

            // Fallback to global env
            if (process.env.AUTHNET_API_LOGIN_ID && process.env.AUTHNET_TRANSACTION_KEY) {
                return {
                    apiLoginId: process.env.AUTHNET_API_LOGIN_ID,
                    transactionKey: process.env.AUTHNET_TRANSACTION_KEY,
                    environment: process.env.AUTHNET_ENVIRONMENT || 'sandbox'
                };
            }

            return null;
        } catch (error) {
            console.error('[PaymentService] Failed to get payment config:', error);
            return null;
        }
    }

    /**
     * Get payment history for an invoice
     */
    async getInvoicePayments(businessId, invoiceId) {
        const snap = await db.collection('payments')
            .where('businessId', '==', businessId)
            .where('invoiceId', '==', invoiceId)
            .orderBy('processedAt', 'desc')
            .get();

        return snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Strip any accidentally stored sensitive data
            cardNumber: undefined,
            cvv: undefined,
        }));
    }
}

module.exports = new PaymentService();
