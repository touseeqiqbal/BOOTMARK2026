const { admin, getDoc, setDoc, getCollectionRef } = require('./db');

class PlanService {
    /**
     * Get all available plans
     */
    async getAllPlans() {
        const snap = await getCollectionRef('plans').get();
        const plans = [];
        snap.forEach(doc => plans.push({ id: doc.id, ...doc.data() }));
        return plans;
    }

    /**
     * Get a specific plan by ID
     */
    async getPlanById(planId) {
        return await getDoc('plans', planId);
    }

    /**
     * Seed default plans if none exist
     */
    async seedDefaultPlans() {
        const existing = await this.getAllPlans();
        if (existing.length > 0) return;

        const defaults = [
            {
                id: 'free',
                name: 'Free',
                price: 0,
                interval: 'monthly',
                features: ['2 Forms', '100 Submissions/mo', 'Basic Analytics'],
                limits: {
                    forms: 2,
                    submissions: 100,
                    teamMembers: 1
                },
                permissions: ['form.view', 'form.submit', 'dashboard.view']
            },
            {
                id: 'pro',
                name: 'Professional',
                price: 49,
                interval: 'monthly',
                features: ['20 Forms', '2,000 Submissions/mo', 'Advanced Analytics', 'Custom Branding', 'Email Support'],
                limits: {
                    forms: 20,
                    submissions: 2000,
                    teamMembers: 5
                },
                permissions: ['form.all', 'dashboard.view', 'analytics.advanced', 'business.branding']
            },
            {
                id: 'enterprise',
                name: 'Enterprise',
                price: 199,
                interval: 'monthly',
                features: ['Unlimited Forms', 'Unlimited Submissions', 'Dedicated Support', 'SLA', 'API Access', 'White Labeling'],
                limits: {
                    forms: 999999,
                    submissions: 999999,
                    teamMembers: 999
                },
                permissions: ['form.all', 'dashboard.view', 'analytics.advanced', 'business.branding', 'api.access', 'white_label.active']
            }
        ];

        for (const plan of defaults) {
            await setDoc('plans', plan.id, plan);
        }
    }

    /**
     * Assign a plan to a tenant
     */
    async assignPlanToTenant(adminId, tenantId, planId) {
        const plan = await this.getPlanById(planId);
        if (!plan) throw new Error('Plan not found');

        const businessRef = admin.firestore().collection('businesses').doc(tenantId);
        await businessRef.update({
            planId,
            planName: plan.name,
            planPrice: plan.price,
            planInterval: plan.interval,
            planLimits: plan.limits,
            updatedAt: new Date().toISOString()
        });

        // Optionally update owner permissions based on plan
        const businessSnap = await businessRef.get();
        const ownerId = businessSnap.data().ownerId;
        if (ownerId) {
            const userRef = admin.firestore().collection('users').doc(ownerId);
            await userRef.update({
                businessPermissions: plan.permissions,
                updatedAt: new Date().toISOString()
            });
        }

        return { success: true };
    }
}

module.exports = new PlanService();
