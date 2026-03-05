const path = require('path');
const { getCollectionRef, getDoc, setDoc } = require('./db');
const { sendEmail } = require('./emailService');
const axios = require('axios');

class AutomationService {
    constructor() {
        this.actions = {
            SEND_EMAIL: 'send_email',
            SYNC_QUICKBOOKS: 'sync_quickbooks',
            WEBHOOK: 'webhook',
            CREATE_TASK: 'create_task'
        };
    }

    /**
     * Trigger automations for a specific event
     * @param {string} eventName - e.g., 'workOrder.statusChanged'
     * @param {Object} context - Data relevant to the event (businessId, entityId, data)
     */
    async trigger(eventName, context) {
        console.log(`[Automation] Triggered event: ${eventName}`, context);

        try {
            const { businessId } = context;
            if (!businessId) return;

            // Fetch active rules for this business and event
            const rulesSnap = await getCollectionRef('automationRules')
                .where('businessId', '==', businessId)
                .where('event', '==', eventName)
                .where('enabled', '==', true)
                .get();

            if (rulesSnap.empty) {
                console.log(`[Automation] No active rules found for ${eventName}`);
                return;
            }

            const rulePromises = [];
            rulesSnap.forEach(doc => {
                const rule = doc.data();
                rulePromises.push(this.executeRule(rule, context));
            });

            await Promise.allSettled(rulePromises);
        } catch (error) {
            console.error(`[Automation] Critical error in trigger logic:`, error);
        }
    }

    /**
     * Executes a single automation rule
     */
    async executeRule(rule, context) {
        console.log(`[Automation] Executing rule: ${rule.name} (${rule.id})`);

        try {
            // Check conditions if they exist
            if (rule.conditions && !this.checkConditions(rule.conditions, context.data)) {
                console.log(`[Automation] Conditions not met for rule ${rule.name}`);
                return;
            }

            const actionPromises = rule.actions.map(action => this.performAction(action, context));
            await Promise.all(actionPromises);

            // Log execution
            await this.logExecution(rule.id, context, 'success');
        } catch (error) {
            console.error(`[Automation] Rule execution failed (${rule.id}):`, error);
            await this.logExecution(rule.id, context, 'failed', error.message);
        }
    }

    checkConditions(conditions, data) {
        // Logic for evaluating conditions (e.g., status == 'Completed')
        // Simple implementation for now
        return Object.keys(conditions).every(key => data[key] === conditions[key]);
    }

    async performAction(action, context) {
        const { type, config } = action;

        switch (type) {
            case this.actions.SEND_EMAIL:
                return this.handleSendEmail(config, context);
            case this.actions.SYNC_QUICKBOOKS:
                return this.handleQuickBooksSync(config, context);
            case this.actions.WEBHOOK:
                return this.handleWebhook(config, context);
            default:
                console.warn(`[Automation] Unknown action type: ${type}`);
        }
    }

    async handleSendEmail(config, context) {
        const { to, subject, templateId } = config;
        // Logic to resolve 'to' if it's a placeholder like 'customer.email'
        let recipient = to;
        if (to === 'customer.email' && context.data?.customerEmail) {
            recipient = context.data.customerEmail;
        }

        if (!recipient) return;

        console.log(`[Automation] Sending email to ${recipient}`);
        return sendEmail({
            to: recipient,
            subject: subject || 'Notification',
            html: `<p>Automated message for ${context.eventName}</p>` // Placeholder for template logic
        });
    }

    async handleQuickBooksSync(config, context) {
        // Since we already have a sync endpoint in quickbooks.js, 
        // we can either call it internally or trigger the logic.
        // For now, we'll log the intent.
        console.log(`[Automation] Triggering QB Sync for ${context.entityId}`);
        // Note: Full implementation would require a business-level QB client setup
    }

    async handleWebhook(config, context) {
        const { url, method = 'POST' } = config;
        console.log(`[Automation] Calling webhook: ${url}`);
        return axios({
            method,
            url,
            data: {
                event: context.eventName,
                timestamp: new Date().toISOString(),
                payload: context.data
            }
        });
    }

    async logExecution(ruleId, context, status, error = null) {
        const logId = `${Date.now()}_${ruleId}`;
        await setDoc('automationLogs', logId, {
            ruleId,
            status,
            error,
            event: context.eventName,
            timestamp: new Date().toISOString(),
            businessId: context.businessId
        });
    }
}

module.exports = new AutomationService();
