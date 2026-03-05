const { getCollectionRef, getDoc, setDoc } = require('./db');
const { sendEmail } = require('./emailService');
const automationService = require('./AutomationService');

class LeadAutomationService {
    /**
     * Scans for leads (Service Requests) that haven't been acted upon in X hours
     */
    async processLeadFollowUps() {
        console.log('[LeadAutomation] Running aging lead check...');

        try {
            const followUpThreshold = 48; // hours
            const now = new Date();
            const thresholdDate = new Date(now.getTime() - (followUpThreshold * 60 * 60 * 1000));

            // Fetch pending service requests older than threshold
            const snap = await getCollectionRef('serviceRequests')
                .where('status', '==', 'pending')
                .where('createdAt', '<=', thresholdDate.toISOString())
                .get();

            if (snap.empty) {
                console.log('[LeadAutomation] No aging leads found.');
                return;
            }

            console.log(`[LeadAutomation] Found ${snap.size} aging leads.`);

            const followUpPromises = [];
            snap.forEach(doc => {
                const lead = doc.data();
                followUpPromises.push(this.followUpOnLead(doc.id, lead));
            });

            await Promise.allSettled(followUpPromises);
        } catch (error) {
            console.error('[LeadAutomation] Error processing leads:', error);
        }
    }

    async followUpOnLead(leadId, lead) {
        // Check if we already followed up to avoid spamming
        if (lead.lastFollowUpAt) {
            const lastFollowUp = new Date(lead.lastFollowUpAt);
            const twentyFourHoursAgo = new Date(new Date().getTime() - (24 * 60 * 60 * 1000));
            if (lastFollowUp > twentyFourHoursAgo) return; // Only follow up once every 24h
        }

        console.log(`[LeadAutomation] Following up on lead: ${leadId}`);

        // 1. Notify the business owner
        const business = await getDoc('businesses', lead.businessId);
        if (business && business.ownerEmail) {
            await sendEmail({
                to: business.ownerEmail,
                subject: `Lead Reminder: ${lead.clientName || 'New Inquiry'}`,
                html: `<p>This lead has been pending for over 48 hours. Please reach out to them!</p>
                       <p><strong>Name:</strong> ${lead.clientName}<br>
                       <strong>Email:</strong> ${lead.clientEmail}<br>
                       <strong>Service:</strong> ${lead.serviceType || 'Not specified'}</p>`
            }).catch(e => console.error('[LeadAutomation] Email failed:', e));
        }

        // 2. Trigger general automation event
        await automationService.trigger('lead.aging', {
            businessId: lead.businessId,
            entityId: leadId,
            eventName: 'lead.aging',
            data: lead
        });

        // 3. Update lead with last follow-up timestamp
        await getCollectionRef('serviceRequests').doc(leadId).update({
            lastFollowUpAt: new Date().toISOString(),
            followUpCount: (lead.followUpCount || 0) + 1
        });
    }
}

module.exports = new LeadAutomationService();
