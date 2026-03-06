/**
 * Script: approve-business.js
 * 
 * Approves a business (sets status: 'active') and grants ALL permissions
 * to its owner via the Firebase Admin SDK / Firestore directly.
 *
 * Usage:
 *   node scripts/approve-business.js <businessId>
 *
 * Example:
 *   node scripts/approve-business.js business_1772757088875_sawpz0ajbk
 */

// Load .env (works in local dev; in production env vars are already present)
try { require('dotenv').config(); } catch (_) { }

const businessId = process.argv[2];

if (!businessId) {
    console.error('❌  Usage: node scripts/approve-business.js <businessId>');
    process.exit(1);
}

// ─── Bootstrap Firebase Admin (reuse your existing db.js) ────────────────────
const { admin, getCollectionRef, getDoc, setDoc } = require('../utils/db');

// ─── All available permission IDs ────────────────────────────────────────────
const { getAllPermissionIds } = require('../utils/businessPermissions');
const ALL_PERMISSIONS = getAllPermissionIds();

async function main() {
    console.log(`\n🔍  Looking up business: ${businessId}`);

    // 1. Fetch the business document
    const businessRef = getCollectionRef('businesses').doc(businessId);
    const businessSnap = await businessRef.get();

    if (!businessSnap.exists) {
        console.error(`❌  Business not found: ${businessId}`);
        process.exit(1);
    }

    const business = { id: businessSnap.id, ...businessSnap.data() };
    console.log(`✅  Found business: "${business.name}" (slug: ${business.slug})`);
    console.log(`    Current status : ${business.status}`);
    console.log(`    Owner UID      : ${business.ownerId}`);

    // 2. Approve the business
    await businessRef.set({
        ...business,
        status: 'active',
        approvedAt: new Date().toISOString(),
        approvedBy: 'super-admin-script',
        updatedAt: new Date().toISOString()
    });
    console.log(`\n✅  Business status set to "active"`);

    // 3. Update the owner's user document
    if (!business.ownerId) {
        console.warn('⚠️  No ownerId on business record — skipping user update.');
        process.exit(0);
    }

    const userRef = getCollectionRef('users').doc(business.ownerId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
        console.warn(`⚠️  Owner user document not found: ${business.ownerId}`);
        process.exit(0);
    }

    const owner = { id: userSnap.id, ...userSnap.data() };
    console.log(`\n👤  Owner: ${owner.email}`);

    await userRef.set({
        ...owner,
        accountStatus: 'active',
        accountType: 'business',
        role: 'owner',
        businessId: businessId,
        businessPendingId: null,
        // Grant every permission defined in businessPermissions.js
        businessPermissions: ALL_PERMISSIONS,
        updatedAt: new Date().toISOString()
    });

    console.log(`✅  Owner account activated`);
    console.log(`✅  All ${ALL_PERMISSIONS.length} permissions granted:`);
    ALL_PERMISSIONS.forEach(p => console.log(`     • ${p}`));
    console.log(`\n🎉  Done! Business "${business.name}" is now fully active.\n`);
    process.exit(0);
}

main().catch(err => {
    console.error('❌  Script failed:', err.message);
    process.exit(1);
});
