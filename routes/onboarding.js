const express = require('express');
const router = express.Router();
const { db } = require('../utils/db');
const { authRequired } = require('../middleware/auth');
const { validateRequest, onboardingSchema } = require('../utils/validation');
const businessService = require('../utils/BusinessService');

/**
 * Complete business onboarding
 * Creates business entity and associates with user
 */
router.post('/complete', authRequired, validateRequest(onboardingSchema), async (req, res) => {
    try {
        const userId = req.user.id || req.user.uid;
        const { businessName, industry } = req.body;

        if (!businessName || !industry) {
            return res.status(400).json({ error: 'Business name and industry are required' });
        }

        // Register the business using the service (handles ID generation and slugging)
        const business = await businessService.registerBusiness(userId, req.body);

        // Add user as an owner in the members collection explicitly for uniform RBAC matching
        const membersRef = db.collection('members');
        const memberId = `${business.id}_${userId}`;
        await membersRef.doc(memberId).set({
            userId,
            businessId: business.id,
            role: 'owner',
            status: 'active',
            joinedAt: new Date().toISOString()
        });

        console.log(`[Onboarding] User ${userId} created business ${business.id} (${business.slug})`);

        res.json({
            success: true,
            businessId: business.id,
            business: business,
            message: 'Onboarding completed successfully'
        });
    } catch (error) {
        console.error('[Onboarding] Error:', error);
        res.status(500).json({
            error: error.message || 'Failed to complete onboarding'
        });
    }
});

/**
 * Get onboarding status
 */
router.get('/status', authRequired, async (req, res) => {
    try {
        const userId = req.user.id || req.user.uid;

        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }

        const status = {
            requiresOnboarding: userData.requiresOnboarding || false,
            onboardingCompleted: userData.onboardingCompleted || false,
            hasBusinessId: !!userData.businessId,
            businessId: userData.businessId || null
        };

        res.json(status);
    } catch (error) {
        console.error('[Onboarding] Error fetching status:', error);
        res.status(500).json({ error: 'Failed to fetch onboarding status' });
    }
});

/**
 * Skip onboarding (for testing/development only)
 * Should be disabled in production
 */
if (process.env.NODE_ENV !== 'production') {
    router.post('/skip', authRequired, async (req, res) => {
        try {
            const userId = req.user.id || req.user.uid;

            await db.collection('users').doc(userId).update({
                requiresOnboarding: false,
                onboardingCompleted: true,
                updatedAt: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Onboarding skipped (development mode only)'
            });
        } catch (error) {
            console.error('[Onboarding] Error skipping:', error);
            res.status(500).json({ error: 'Failed to skip onboarding' });
        }
    });
}

module.exports = router;
