/**
 * Platform Bootstrapping Utility (Cold Start)
 * 
 * This script initializes a fresh Firestore database with:
 * 1. Platform Configuration (Admin limits, etc.)
 * 2. Default Subscription Plans (Free, Pro, Enterprise)
 * 3. Initial Super Admin Promotion
 * 
 * Usage:
 *   node scripts/bootstrap-platform.js --uid <FIREBASE_UID> --email <EMAIL>
 */

const { admin, setDoc, getDoc } = require('../utils/db');
const planService = require('../utils/PlanService');

async function bootstrap() {
    const args = process.argv.slice(2);
    const uidArg = args.find(a => a === '--uid' || a === '-u');
    const emailArg = args.find(a => a === '--email' || a === '-e');

    const uid = uidArg ? args[args.indexOf(uidArg) + 1] : null;
    const email = emailArg ? args[args.indexOf(emailArg) + 1] : null;

    console.log('\n🚀 Starting Platform Bootstrap (Cold Start)...');

    try {
        // 1. Initialize Platform Configuration
        console.log('📦 Initializing Platform Configuration...');
        const config = {
            allowedAdmins: [uid].filter(Boolean),
            adminLimit: 2,
            mfaEnforced: true,
            updatedAt: new Date().toISOString(),
            initializedAt: new Date().toISOString()
        };
        await setDoc('platform', 'config', config);
        console.log('✅ Platform configuration initialized.');

        // 2. Seed Default Subscription Plans
        console.log('💳 Seeding Subscription Plans...');
        await planService.seedDefaultPlans();
        console.log('✅ Subscription plans seeded.');

        // 3. Promote Initial Super Admin
        if (uid && email) {
            console.log(`👨‍💼 Promoting user ${email} (${uid}) to Super Admin...`);

            // Check if user exists, if not create a minimal record
            const userDoc = await getDoc('users', uid);
            const userData = userDoc || {
                uid,
                email,
                name: 'Initial Admin',
                createdAt: new Date().toISOString()
            };

            const updatedUser = {
                ...userData,
                isSuperAdmin: true,
                role: 'super_admin',
                accountStatus: 'active',
                updatedAt: new Date().toISOString()
            };

            await setDoc('users', uid, updatedUser);
            console.log('✅ Initial Super Admin promoted.');
        } else {
            console.log('⚠️  No UID/Email provided. Skipping Super Admin promotion.');
            console.log('   Use --uid and --email to promote a user during bootstrap.');
        }

        // 4. Initialize Audit Logs collection (minimal entry)
        console.log('📜 Initializing Platform Audit Logs...');
        await setDoc('platformAuditLogs', 'init', {
            action: 'PLATFORM_BOOTSTRAP',
            timestamp: new Date().toISOString(),
            details: { message: 'Platform initialized from cold start script' }
        });
        console.log('✅ Global audit logs initialized.');

        console.log('\n✨ Bootstrap Complete! The platform is now ready for use.');
        console.log('Next Steps:');
        console.log('1. Log in to the Super Admin Panel at /admin/dashboard');
        console.log('2. Complete MFA registration for your account');
        console.log('3. Start onboarding businesses!\n');

    } catch (error) {
        console.error('\n❌ Bootstrap failed:', error.message);
        process.exit(1);
    }
}

bootstrap();
