const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const { getDoc, setDoc, admin } = require('../utils/db');

/**
 * Super Admin Support Routes
 * ONLY accessible to users with isSuperAdmin: true
 */

// Middleware to ensure ONLY super admins can access these
const superAdminOnly = (req, res, next) => {
    if (req.user && req.user.isSuperAdmin) {
        return next();
    }
    res.status(403).json({ error: "Unauthorized. Super Admin access required." });
};

/**
 * Reset Business Account
 * Clears all transaction/operational data but keeps the business record.
 */
router.post('/reset-business/:businessId', authRequired, superAdminOnly, async (req, res) => {
    const { businessId } = req.params;
    const { confirm } = req.body;

    if (confirm !== 'RESET') {
        return res.status(400).json({ error: "Please provide confirmation 'RESET' to proceed." });
    }

    try {
        const db = admin.firestore();

        // Define collections to clear
        const collectionsToClear = [
            'forms',
            'workOrders',
            'invoices',
            'customers',
            'estimates',
            'submissions',
            'chat_messages'
        ];

        // Batch delete/clear logic (simplified for walkthrough)
        // In production, we'd use recursive deletes for sub-collections
        for (const coll of collectionsToClear) {
            const snapshot = await db.collection(coll).where('businessId', '==', businessId).get();
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }

        console.log(`[Admin] Business ${businessId} has been reset by ${req.user.email}`);
        res.json({ success: true, message: "Business data successfully cleared." });
    } catch (error) {
        console.error('Reset Business Error:', error);
        res.status(500).json({ error: "Failed to reset business data" });
    }
});

/**
 * Full Business Deletion
 */
router.delete('/business/:businessId', authRequired, superAdminOnly, async (req, res) => {
    const { businessId } = req.params;

    try {
        const db = admin.firestore();

        // 1. Delete matching memberships
        const memberships = await db.collection('memberships').where('businessId', '==', businessId).get();
        const batch = db.batch();
        memberships.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        // 2. Delete business document
        await db.collection('businesses').doc(businessId).delete();

        res.json({ success: true, message: "Business and all memberships deleted." });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete business" });
    }
});

module.exports = router;
