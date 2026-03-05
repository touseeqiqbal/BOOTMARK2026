const express = require("express");
const path = require("path");
const { admin, useFirestore, getCollectionRef, getDoc, setDoc } = require(path.join(__dirname, "..", "utils", "db"));
let OAuthClient;
try {
  const intuitOAuth = require("intuit-oauth");
  OAuthClient = (typeof intuitOAuth === 'function') ? intuitOAuth : (intuitOAuth.OAuthClient || intuitOAuth.default || intuitOAuth);
} catch (error) {
  console.error("Failed to import intuit-oauth:", error);
}
const QuickBooks = require("node-quickbooks");

const router = express.Router();
const { requireAdmin } = require('../middleware/authorize');

const qbConfig = {
  clientId: process.env.QUICKBOOKS_CLIENT_ID || "",
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || "",
  environment: process.env.QUICKBOOKS_ENVIRONMENT || "sandbox",
  redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || `${process.env.APP_URL || "http://localhost:4000"}/api/quickbooks/callback`
};

async function getUserIdFromToken(req) {
  const token = req.headers?.authorization?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    return null;
  }
}

// GET QuickBooks auth URL
router.get("/auth-url", requireAdmin, async (req, res) => {
  try {
    if (!qbConfig.clientId || !qbConfig.clientSecret) return res.status(400).json({ error: "Credentials missing" });
    const userId = await getUserIdFromToken(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const user = await getDoc('users', userId);
    if (!user || !user.businessId) return res.status(400).json({ error: "Business ID required" });

    const stateToken = crypto.randomBytes(32).toString('hex');
    await setDoc('tempAuthStates', stateToken, {
      userId,
      businessId: user.businessId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min
    });

    const authUri = oauthClient.authorizeUri({
      scope: ['com.intuit.quickbooks.accounting', 'openid'],
      state: stateToken
    });

    res.json({ authUrl: authUri });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// QuickBooks OAuth callback
router.get("/callback", async (req, res) => {
  try {
    const { code, realmId, state } = req.query;
    if (!code || !realmId) return res.redirect(`${process.env.FRONTEND_URL}/account-settings?quickbooks=error`);

    const oauthClient = new OAuthClient({
      clientId: qbConfig.clientId,
      clientSecret: qbConfig.clientSecret,
      environment: qbConfig.environment,
      redirectUri: qbConfig.redirectUri
    });

    const authResponse = await oauthClient.createToken(req.url);
    const tokenData = authResponse.getJson();

    // 1. Verify and consume state token
    const stateDoc = await getDoc('tempAuthStates', state);
    if (!stateDoc || new Date(stateDoc.expiresAt) < new Date()) {
      return res.redirect(`${process.env.FRONTEND_URL}/account-settings?quickbooks=error&reason=invalid_state`);
    }
    const { userId, businessId } = stateDoc;
    // Consume token (delete)
    await admin.firestore().collection('tempAuthStates').doc(state).delete().catch(() => { });

    if (userId && businessId) {
      const user = await getDoc('users', userId);
      if (user) {
        if (!user.businesses) user.businesses = {};
        if (!user.businesses[businessId]) user.businesses[businessId] = {};
        user.businesses[businessId].quickbooks = {
          realmId,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          connectedAt: new Date().toISOString()
        };
        await setDoc('users', userId, user);
      }
    }
    res.redirect(`${process.env.FRONTEND_URL}/account-settings?quickbooks=success&realmId=${realmId}`);
  } catch (error) {
    res.redirect(`${process.env.FRONTEND_URL}/account-settings?quickbooks=error`);
  }
});

// Helper to get a Promisified QuickBooks client
async function getQBClient(userId, businessId) {
  const user = await getDoc('users', userId);
  const qbConnection = user?.businesses?.[businessId]?.quickbooks;
  if (!qbConnection) throw new Error("QuickBooks not connected");

  const oauthClient = new OAuthClient({
    clientId: qbConfig.clientId,
    clientSecret: qbConfig.clientSecret,
    environment: qbConfig.environment,
    redirectUri: qbConfig.redirectUri
  });

  // Check if token needs refresh (simplified check, usually library handles or throw error)
  // For production, we'd check expiry and call oauthClient.refresh()

  return new QuickBooks(
    qbConfig.clientId,
    qbConfig.clientSecret,
    qbConnection.accessToken,
    false, // no token secret for OAuth2
    qbConnection.realmId,
    qbConfig.environment === "production",
    true, // post-only
    null, // no minor version
    '2.0', // oauth version
    qbConnection.refreshToken
  );
}

// Sync form submissions to QuickBooks
router.post("/sync", requireAdmin, async (req, res) => {
  try {
    const userId = await getUserIdFromToken(req);
    const { formId, submissionIds } = req.body;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await getDoc('users', userId);
    const businessId = user?.businessId;
    if (!businessId) return res.status(400).json({ error: "Business not found" });

    const form = await getDoc('forms', formId);
    if (!form || (form.businessId !== businessId && form.userId !== userId)) {
      return res.status(404).json({ error: "Form not found" });
    }

    // Get submissions to sync
    const snap = await getCollectionRef('submissions').where('formId', '==', formId).get();
    const submissions = [];
    snap.forEach(d => {
      if (!submissionIds || submissionIds.includes(d.id)) {
        submissions.push({ id: d.id, ...d.data() });
      }
    });

    if (submissions.length === 0) return res.json({ success: true, message: "No submissions to sync" });

    const qb = await getQBClient(userId, businessId);
    const results = { success: 0, failed: 0, errors: [] };

    const customerService = require('../utils/CustomerService');

    for (const submission of submissions) {
      try {
        const { customerName, customerEmail } = customerService.extractCustomerInfo(form, submission.data || {});

        if (!customerName && !customerEmail) {
          throw new Error("Could not extract customer info from submission");
        }

        // 1. Find or Create Customer in QB
        let qbCustomerId;
        const customers = await new Promise((resolve, reject) => {
          qb.findCustomers({ PrimaryEmailAddr: customerEmail }, (err, data) => err ? reject(err) : resolve(data));
        });

        if (customers.QueryResponse.Customer && customers.QueryResponse.Customer.length > 0) {
          qbCustomerId = customers.QueryResponse.Customer[0].Id;
        } else {
          const newCust = await new Promise((resolve, reject) => {
            qb.createCustomer({
              DisplayName: customerName || customerEmail,
              PrimaryEmailAddr: { Address: customerEmail }
            }, (err, data) => err ? reject(err) : resolve(data));
          });
          qbCustomerId = newCust.Id;
        }

        // 2. Create Invoice in QB
        // Simplified: One line item for the "Form Submission"
        const amount = Number(submission.data?.totalAmount || submission.data?.price || 0);
        const invoice = await new Promise((resolve, reject) => {
          qb.createInvoice({
            CustomerRef: { value: qbCustomerId },
            Line: [{
              Amount: amount,
              DetailType: "SalesItemLineDetail",
              SalesItemLineDetail: {
                ItemRef: { name: "Services", value: "1" } // Usually need a valid Item ID from QB
              }
            }]
          }, (err, data) => err ? reject(err) : resolve(data));
        });

        // 3. Mark as synced in Firestore
        await setDoc('submissions', submission.id, {
          ...submission,
          quickbooksId: invoice.Id,
          quickbooksSyncAt: new Date().toISOString()
        });

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({ id: submission.id, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Sync completed: ${results.success} synced, ${results.failed} failed`,
      results
    });
  } catch (error) {
    console.error("QB Sync Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Check connection status
router.get("/status", requireAdmin, async (req, res) => {
  try {
    const userId = await getUserIdFromToken(req);
    if (!userId) return res.json({ isConnected: false });

    const user = await getDoc('users', userId);
    if (!user || !user.businessId) return res.json({ isConnected: false });

    const qbConnection = user.businesses?.[user.businessId]?.quickbooks;
    const isConnected = !!(qbConnection && qbConnection.accessToken);

    res.json({
      isConnected,
      lastSync: qbConnection?.lastSync || null,
      realmId: qbConnection?.realmId || null
    });
  } catch (error) {
    console.error("QB Status Error:", error);
    res.json({ isConnected: false });
  }
});

module.exports = router;
