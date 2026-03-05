## 0. New Database Setup (Cold Start)
If you are starting with a completely empty Firestore database, you must bootstrap the platform configuration and seed initial plans.

1.  Open your terminal in the project root.
2.  Run the bootstrap utility:
    ```bash
    node scripts/bootstrap-platform.js --uid <YOUR_FIREBASE_UID> --email <YOUR_EMAIL>
    ```
    - Replace `<YOUR_FIREBASE_UID>` with the UID from your Firebase Auth dashboard.
    - This will initialize the admin limits, seed subscription plans, and promote your account to Super Admin.

3.  Proceed to **MFA Setup** in the next section.

## 1. Designate a Super Admin (Existing Database)
Since the platform is locked down to 2 admins, you must manually promote your account first.

1. Open your Firestore console or a local script.
2. Find your user document in the `users` collection.
3. Set `isSuperAdmin: true`.
4. (Optional) Set `role: "super_admin"` for custom claims consistency.

## 2. MFA Setup (TOTP)
1. Log in to the application with your promoted account.
2. Navigate to `/admin/dashboard`. You should be redirected or prompted for MFA.
3. Go to `/admin/mfa-setup`.
4. Scan the QR code with an authenticator app (e.g., Google Authenticator).
5. Enter the verification code to link your account.
6. **Verify**: Log out and log back in. Accessing sensitive `/admin` pages should now require a TOTP token after login.

## 3. Platform Dashboard & Plans
1. **Metrics**: Verify the counts for "Active Tenants", "MRR", and "Plan Distribution" are displayed.
2. **Plan Manager**: Navigate to **Plan Manager** from the sidebar.
3. **Seed Plans**: If the list is empty, click **"Seed Default Plans"**. This will populate the `plans` collection.
4. **Verify**: Go to the `plans` collection in Firestore to see the Free, Pro, and Enterprise tiers.

## 4. Tenant Management & Impersonation (Step-up Verification)
1. **Tenants Directory**: Go to **Tenants Directory**. You should see a list of businesses.
2. **Tenant Detail**: Click on any tenant to view their details.
3. **Change Plan**: Go to the **Billing** tab and try to change the tenant's plan.
    - **Step-up Check**: Since this is a sensitive action, you should be prompted for your MFA code again if it's been >5 minutes.
4. **Impersonation**: On the **Overview** tab, click **"Impersonate Owner"**.
    - **Verification**: You should be redirected to `/dashboard` with a blue **"Impersonating [Email]"** banner at the top.
    - **Verify**: Try to view a form or submission as the impersonated user.
    - **Exit**: Click **"Exit Session"** in the banner. You should return to the Super Admin context.

## 5. Webhook Explorer & Billing Ledger
1. **Webhook Explorer**: Navigate to **Webhook Explorer** in the sidebar.
2. **Test Ingestion**: Run the following `curl` command (or use a tool like Postman):
   ```bash
   curl -X POST http://localhost:4000/api/webhooks/test \
   -H "Content-Type: application/json" \
   -d '{"test": "payload", "event": "verification"}'
   ```
3. **Verify**: Refresh the Webhook Explorer. You should see the `test` provider entry. Click it to inspect the raw JSON and headers.
4. **Billing Ledger**: Go to **Billing Ledger**.
    - If you have existing `paymentAttempts` in your database, they will appear here.
    - **Verify**: Filter by "Failed" to see any transaction errors.

## 6. System Alerts
1. Navigate to **System Alerts**.
2. **Verify**: Any failed webhooks or payment attempts from the previous steps should appear as alerts in the inbox.

## 7. Security Regression
1. Log in with a **NON-admin** account.
2. Attempt to navigate directly to `/admin/dashboard`.
3. **Verify**: You should be redirected to the home page or receive a (403/Forbidden) error.
4. **Verify**: Check the browser console; calls to `/api/platform/*` should return a 403.
