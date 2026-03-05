const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');
const { getDoc, setDoc, getCollectionRef } = require(path.join(__dirname, '..', 'utils', 'db'));
const { getCustomers } = require('./customers');
const { authRequired } = require('../middleware/auth');

// Helper: Find customer by invitation token
async function findCustomerByToken(token) {
    const snap = await getCollectionRef('customers').where('invitationToken', '==', token).limit(1).get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// GET /api/client-invitations/verify/:token
router.get('/verify/:token', async (req, res) => {
    try {
        const customer = await findCustomerByToken(req.params.token);
        if (!customer) return res.status(404).json({ error: 'Invalid invitation link' });

        if (customer.invitationExpiry && new Date(customer.invitationExpiry) < new Date()) {
            return res.status(400).json({ error: 'Invitation expired' });
        }

        if (customer.accountCreated) {
            return res.status(400).json({ error: 'Account already created' });
        }

        res.json({ valid: true, email: customer.email, name: customer.name });
    } catch (error) {
        res.status(500).json({ error: 'Failed to verify invitation' });
    }
});

// POST /api/client-invitations/accept
router.post('/accept', async (req, res) => {
    try {
        const { token, password, name, googleToken } = req.body;
        const customer = await findCustomerByToken(token);
        if (!customer) return res.status(404).json({ error: 'Invalid invitation' });

        const admin = require('firebase-admin');
        let userRecord;

        if (googleToken) {
            // ─── Google-based acceptance ───
            try {
                const decodedGoogle = await admin.auth().verifyIdToken(googleToken);

                // Security: verify Google email is verified and matches invitation email
                if (!decodedGoogle.email_verified) {
                    return res.status(403).json({ error: 'Google account email must be verified to accept invitation.' });
                }

                if (decodedGoogle.email !== customer.email) {
                    return res.status(403).json({
                        error: 'The Google account email does not match the invitation email'
                    });
                }

                // Get or create the Firebase user
                try {
                    userRecord = await admin.auth().getUserByEmail(customer.email);
                } catch (e) {
                    userRecord = await admin.auth().createUser({
                        email: customer.email,
                        displayName: name || customer.name || decodedGoogle.name,
                        emailVerified: true
                    });
                }

                // HARDENED: Merge existing claims
                const currentClaims = (await admin.auth().getUser(userRecord.uid)).customClaims || {};
                await admin.auth().setCustomUserClaims(userRecord.uid, {
                    ...currentClaims,
                    role: currentClaims.role === 'admin' ? 'admin' : 'client',
                    businessId: customer.businessId || customer.userId,
                    customerId: customer.id
                });

                // Store Google provider link in user doc
                const existingUser = await getDoc('users', userRecord.uid);
                await setDoc('users', userRecord.uid, {
                    ...(existingUser || {}),
                    id: userRecord.uid,
                    uid: userRecord.uid,
                    email: customer.email,
                    name: name || customer.name || decodedGoogle.name,
                    role: 'client',
                    businessId: customer.businessId || customer.userId,
                    googleProviderId: decodedGoogle.uid,
                    provider: 'google.com',
                    updatedAt: new Date().toISOString()
                });

            } catch (googleError) {
                console.error('Google token verification failed:', googleError);
                return res.status(400).json({ error: 'Invalid Google token' });
            }
        } else {
            // ─── Password-based acceptance (original flow) ───
            try {
                userRecord = await admin.auth().createUser({
                    email: customer.email,
                    password,
                    displayName: name || customer.name,
                    emailVerified: true
                });
                await admin.auth().setCustomUserClaims(userRecord.uid, {
                    role: 'client',
                    businessId: customer.businessId || customer.userId,
                    customerId: customer.id
                });
            } catch (authError) {
                if (authError.code === 'auth/email-already-exists') {
                    const existingUser = await admin.auth().getUserByEmail(customer.email);
                    // HARDENED: Merge existing claims
                    const currentClaims = (await admin.auth().getUser(existingUser.uid)).customClaims || {};
                    await admin.auth().setCustomUserClaims(existingUser.uid, {
                        ...currentClaims,
                        role: currentClaims.role === 'admin' ? 'admin' : 'client',
                        businessId: customer.businessId || customer.userId,
                        customerId: customer.id
                    });
                } else {
                    throw authError;
                }
            }
        }

        customer.accountCreated = true;
        customer.accountCreatedAt = new Date().toISOString();
        customer.invitationToken = null;
        customer.name = name || customer.name;

        await setDoc('customers', customer.id, customer);
        res.json({ success: true, email: customer.email });
    } catch (error) {
        console.error('Accept invitation error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// POST /api/client-invitations/resend/:customerId
router.post('/resend/:customerId', authRequired, async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        const customer = await getDoc('customers', req.params.customerId);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        // Enforce Tenant Isolation
        if (customer.businessId !== businessId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        customer.invitationToken = token;
        customer.invitationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        customer.invitationSentAt = new Date().toISOString();

        await setDoc('customers', customer.id, customer);
        const { sendClientInvitation } = require('./customers');
        await sendClientInvitation(customer, token);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to resend invitation' });
    }
});

// DELETE /api/client-invitations/revoke/:customerId
// Revoke a pending invitation for a customer
router.delete('/revoke/:customerId', authRequired, async (req, res) => {
    try {
        const businessId = req.user?.businessId;
        if (!businessId) return res.status(403).json({ error: 'Business context required' });

        const customer = await getDoc('customers', req.params.customerId);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });

        if (customer.businessId !== businessId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (customer.accountCreated) {
            return res.status(400).json({ error: 'Cannot revoke — account already created' });
        }

        // Clear the invitation token and expiry
        await setDoc('customers', req.params.customerId, {
            ...customer,
            invitationToken: null,
            invitationExpiry: null,
            invitationRevoked: true,
            revokedAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Invitation revoked' });
    } catch (error) {
        console.error('Error revoking invitation:', error);
        res.status(500).json({ error: 'Failed to revoke invitation' });
    }
});

module.exports = router;
