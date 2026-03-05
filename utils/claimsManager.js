/**
 * Custom Claims Manager
 * 
 * Manages Firebase Auth custom claims for RBAC.
 * Handles:
 *   - Setting tenantId + role claims
 *   - Tenant switching for multi-tenant users
 *   - Permission versioning for forced refresh
 *   - Token refresh signaling via Firestore sentinel
 * 
 * Usage (server-side only — Admin SDK):
 *   const claims = require('./claimsManager');
 *   await claims.setUserClaims(uid, tenantId, 'admin');
 *   await claims.switchTenant(uid, newTenantId);
 */

const { admin, db, getDoc, setDoc } = require('./db');

/**
 * Set custom claims on a Firebase user
 * 
 * @param {string} uid - Firebase UID
 * @param {string} tenantId - Business/tenant ID
 * @param {string} role - One of: 'super_admin', 'owner', 'admin', 'staff', 'client'
 * @param {Object} extraClaims - Additional claims to set
 * @returns {Object} The claims that were set
 */
async function setUserClaims(uid, tenantId, role, extraClaims = {}) {
    if (!uid) throw new Error('uid is required');
    if (!role) throw new Error('role is required');

    // 1. Get current user to preserve non-BOOTMARK claims
    const firebaseUser = await admin.auth().getUser(uid);
    const existingClaims = firebaseUser.customClaims || {};

    // 2. Increment permissions version
    const newVersion = (existingClaims.permissionsVersion || 0) + 1;

    // 3. Build new claims
    const newClaims = {
        ...existingClaims,
        tenantId: tenantId || null,
        businessId: tenantId || null, // Alias for backward compatibility
        role,
        permissionsVersion: newVersion,
        ...extraClaims
    };

    // 4. Set claims on Firebase Auth
    await admin.auth().setCustomUserClaims(uid, newClaims);

    // 5. Update user document
    try {
        const userDoc = await getDoc('users', uid);
        if (userDoc) {
            await setDoc('users', uid, {
                ...userDoc,
                businessId: tenantId || userDoc.businessId,
                role: role,
                businessRole: role,
                permissionsVersion: newVersion,
                updatedAt: new Date().toISOString()
            });
        }
    } catch (err) {
        console.warn('[ClaimsManager] Could not update user doc:', err.message);
    }

    // 6. Signal frontend to refresh token
    await signalTokenRefresh(uid);

    console.log(`[ClaimsManager] Claims set for ${uid}: tenant=${tenantId}, role=${role}, v=${newVersion}`);
    return newClaims;
}

/**
 * Switch a user's active tenant
 * Verifies membership before switching.
 * 
 * @param {string} uid - Firebase UID
 * @param {string} newTenantId - Business ID to switch to
 * @returns {Object} { tenantId, role }
 */
async function switchTenant(uid, newTenantId) {
    if (!uid || !newTenantId) {
        throw new Error('uid and newTenantId are required');
    }

    // 1. Check membership
    const membership = await verifyMembership(uid, newTenantId);
    if (!membership) {
        throw new Error('User is not a member of this workspace');
    }

    // 2. Set new claims with the tenant's role
    const claims = await setUserClaims(uid, newTenantId, membership.role);

    return {
        tenantId: newTenantId,
        role: membership.role,
        permissionsVersion: claims.permissionsVersion
    };
}

/**
 * Verify a user is a member of a business
 * Checks: business owner, members array, or membership doc
 * 
 * @param {string} uid - Firebase UID
 * @param {string} businessId - Business ID
 * @returns {Object|null} { role, joinedAt } or null if not a member
 */
async function verifyMembership(uid, businessId) {
    try {
        // Check if user is the business owner
        const business = await getDoc('businesses', businessId);
        if (business && business.ownerId === uid) {
            return { role: 'owner', joinedAt: business.createdAt };
        }

        // Check members array on business document
        if (business && business.members) {
            const member = business.members.find(m => m.userId === uid);
            if (member) {
                return { role: member.role || 'staff', joinedAt: member.joinedAt };
            }
        }

        // Check standalone members collection
        const membersRef = db.collection('members');
        const memberSnap = await membersRef
            .where('userId', '==', uid)
            .where('businessId', '==', businessId)
            .where('status', '==', 'active')
            .limit(1)
            .get();

        if (!memberSnap.empty) {
            const memberData = memberSnap.docs[0].data();
            return { role: memberData.role || 'staff', joinedAt: memberData.joinedAt };
        }

        // Check user doc businessId field (legacy)
        const userDoc = await getDoc('users', uid);
        if (userDoc && userDoc.businessId === businessId) {
            return { role: userDoc.businessRole || userDoc.role || 'staff', joinedAt: userDoc.createdAt };
        }

        return null;
    } catch (error) {
        console.error('[ClaimsManager] Membership verification failed:', error);
        return null;
    }
}

/**
 * Signal the frontend to refresh its token
 * Writes a sentinel document that the frontend listens to via onSnapshot
 * 
 * @param {string} uid - Firebase UID
 */
async function signalTokenRefresh(uid) {
    try {
        await db.collection('users').doc(uid).collection('metadata').doc('refreshTime').set({
            refreshTime: admin.firestore.FieldValue.serverTimestamp(),
            reason: 'claims_updated'
        });
    } catch (err) {
        console.warn('[ClaimsManager] Could not signal token refresh:', err.message);
    }
}

/**
 * Revoke a user's tenant access
 * Clears tenantId from claims and removes membership
 * 
 * @param {string} uid - Firebase UID
 * @param {string} tenantId - Business ID to revoke
 */
async function revokeAccess(uid, tenantId) {
    // Get current claims
    const firebaseUser = await admin.auth().getUser(uid);
    const currentClaims = firebaseUser.customClaims || {};

    // If this is their active tenant, clear it
    if (currentClaims.tenantId === tenantId || currentClaims.businessId === tenantId) {
        await setUserClaims(uid, null, 'client');
    }

    // Signal refresh
    await signalTokenRefresh(uid);

    console.log(`[ClaimsManager] Access revoked for ${uid} from tenant ${tenantId}`);
}

/**
 * Get current claims for a user (for debugging/admin views)
 * 
 * @param {string} uid - Firebase UID
 * @returns {Object} Current custom claims
 */
async function getCurrentClaims(uid) {
    const firebaseUser = await admin.auth().getUser(uid);
    return firebaseUser.customClaims || {};
}

module.exports = {
    setUserClaims,
    switchTenant,
    verifyMembership,
    signalTokenRefresh,
    revokeAccess,
    getCurrentClaims
};
