const express = require("express");
const router = express.Router();
const { admin, getCollectionRef, getDoc, setDoc } = require("../utils/db");

const { authRequired } = require("../middleware/auth");
const mfaService = require("../utils/MFAService");



// Verify Firebase token
router.post("/verify-firebase-token", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token is required" });

    const decodedToken = await admin.auth().verifyIdToken(token);
    const doc = await getDoc('users', decodedToken.uid);
    let user = doc;
    const isGoogleProvider = decodedToken.firebase.sign_in_provider === 'google.com';

    if (!user) {
      // User not found by UID — check by email to link existing accounts
      // (e.g. client created via invite with password, now signing in with Google)
      const usersRef = getCollectionRef('users');
      const emailSnapshot = await usersRef.where('email', '==', decodedToken.email).get();

      if (!emailSnapshot.empty) {
        // Found existing user by email — link Google provider to their account
        const existingDoc = emailSnapshot.docs[0];
        user = existingDoc.data();
        if (isGoogleProvider && !user.googleProviderId) {
          user.googleProviderId = decodedToken.uid;
          user.photoURL = user.photoURL || decodedToken.picture || "";
          await setDoc('users', existingDoc.id, user);
        }
        // Update session to use existing user's ID
        user.uid = existingDoc.id;
        user.id = existingDoc.id;
      } else {
        // Truly new user — create a new record
        user = {
          id: decodedToken.uid,
          uid: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name || decodedToken.email?.split("@")[0],
          photoURL: decodedToken.picture || "",
          createdAt: new Date().toISOString(),
          provider: decodedToken.firebase.sign_in_provider
        };
        if (isGoogleProvider) {
          user.googleProviderId = decodedToken.uid;
        }
        await setDoc('users', user.uid, user);
      }
    } else if (isGoogleProvider && !user.googleProviderId) {
      // Link Google provider to existing user on first Google sign-in
      user.googleProviderId = decodedToken.uid;
      user.photoURL = user.photoURL || decodedToken.picture || "";
      await setDoc('users', user.uid, user);
    }

    // SECURITY: Regenerate session on login to prevent session fixation
    const oldSession = { ...req.session };
    req.session.regenerate((err) => {
      if (err) console.error("Session regeneration error:", err);
      Object.assign(req.session, oldSession);
      req.session.authenticated = true;
      req.session.userId = user.uid;
      req.session.userEmail = user.email;
      req.session.save();
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: "Token verification failed" });
  }
});

// Check if user exists
router.post('/check-user', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const usersRef = getCollectionRef('users');
    const snapshot = await usersRef.where('email', '==', email).get();

    if (snapshot.empty) {
      return res.status(404).json({ exists: false });
    }

    const user = snapshot.docs[0].data();
    res.json({
      exists: true,
      hasPassword: !!user.passwordHash, // simplistic check
      provider: user.provider || 'password'
    });
  } catch (error) {
    console.error('Check user error:', error);
    res.status(500).json({ error: 'Failed to check user' });
  }
});

// Google Lookup — check if a Google email exists and return role/business info
router.post('/google-lookup', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const usersRef = getCollectionRef('users');
    const snapshot = await usersRef.where('email', '==', email).get();

    if (snapshot.empty) {
      return res.json({ exists: false });
    }

    const user = snapshot.docs[0].data();

    // Check if user has a business
    let hasBusiness = false;
    if (user.businessId) {
      const business = await getDoc('businesses', user.businessId);
      hasBusiness = !!business;
    }

    res.json({
      exists: true,
      role: user.role || 'user',
      hasBusiness,
      hasGoogleLinked: !!user.googleProviderId,
      provider: user.provider || 'password',
      accountStatus: user.accountStatus || 'active'
    });
  } catch (error) {
    console.error('Google lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup user' });
  }
});

// Link Google account to existing user
router.post('/link-google', authRequired, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { token } = req.body; // Assuming token is passed in req.body for verification
    // Verify Google ID token and check email verification
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (!decodedToken.email_verified) {
      return res.status(403).json({ error: "Email not verified in Google account. Please verify your email first." });
    }

    const { googleUid, email } = req.body;

    if (!googleUid || !email) {
      return res.status(400).json({ error: 'Google UID and email are required' });
    }

    const user = await getDoc('users', userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Security: verify the email matches the logged-in user
    if (user.email !== email) {
      return res.status(403).json({ error: 'Google email does not match your account email' });
    }

    // Check if another account already has this Google UID
    const existingRef = getCollectionRef('users');
    const existingSnap = await existingRef.where('googleProviderId', '==', googleUid).get();
    if (!existingSnap.empty && existingSnap.docs[0].id !== userId) {
      return res.status(409).json({ error: 'This Google account is already linked to another user' });
    }

    await setDoc('users', userId, {
      ...user,
      googleProviderId: googleUid,
      updatedAt: new Date().toISOString()
    });

    res.json({ success: true, message: 'Google account linked successfully' });
  } catch (error) {
    console.error('Link Google error:', error);
    res.status(500).json({ error: 'Failed to link Google account' });
  }
});

// Unlink Google account from user
router.post('/unlink-google', authRequired, async (req, res) => {
  try {
    const userId = req.user.uid;
    const user = await getDoc('users', userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.googleProviderId) {
      return res.status(400).json({ error: 'No Google account linked' });
    }

    // Safety: ensure user has another auth method (password) before unlinking
    const firebaseUser = await admin.auth().getUser(userId);
    const hasPasswordProvider = firebaseUser.providerData.some(p => p.providerId === 'password');
    if (!hasPasswordProvider) {
      return res.status(400).json({ error: 'Cannot unlink Google — it is your only sign-in method. Set a password first.' });
    }

    const updated = { ...user, updatedAt: new Date().toISOString() };
    delete updated.googleProviderId;
    await setDoc('users', userId, updated);

    res.json({ success: true, message: 'Google account unlinked successfully' });
  } catch (error) {
    console.error('Unlink Google error:', error);
    res.status(500).json({ error: 'Failed to unlink Google account' });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy();
  res.clearCookie('token');
  res.clearCookie('sessionId');
  res.json({ message: "Logged out successfully" });
});

// ========================================
// ADVANCED MFA (TOTP / AUTHENTICATOR)
// ========================================

/**
 * Generate TOTP Setup Secret
 * Returns secret (stored in session temporarily) and QR Code
 */
router.post("/mfa/totp/setup", authRequired, async (req, res) => {
  try {
    const userId = req.user.uid;
    const user = await getDoc('users', userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const mfaEmail = user.email || req.user.email || `${userId}@bootmark.app`;

    const { secret, otpauthUrl } = mfaService.generateSecret(mfaEmail);
    const qrCodeDataUrl = await mfaService.generateQRCode(otpauthUrl);

    // Store secret in session for verification phase
    req.session.tempTotpSecret = secret;

    res.json({
      qrCode: qrCodeDataUrl,
      message: "Scan this QR code with your Authenticator app"
    });
  } catch (error) {
    console.error('TOTP Setup Error:', error.message);
    res.status(500).json({ error: "Failed to initialize TOTP setup" });
  }
});

/**
 * Verify TOTP Setup
 * Finalizes TOTP enablement for the user
 */
router.post("/mfa/totp/verify-setup", authRequired, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.uid;
    const secret = req.session.tempTotpSecret;

    if (!secret) return res.status(400).json({ error: "Setup session expired. Please restart setup." });

    const isValid = mfaService.verifyToken(token, secret);
    if (!isValid) return res.status(400).json({ error: "Invalid code. Please try again." });

    // Save secret to secure collection (HARDENED)
    await setDoc('mfaSecrets', userId, {
      totpSecret: secret,
      updatedAt: new Date().toISOString()
    });

    const user = await getDoc('users', userId);
    await setDoc('users', userId, {
      ...user,
      twoFactorMethod: 'totp',
      twoFactorEnabled: true
    });

    delete req.session.tempTotpSecret;
    res.json({ success: true, message: "Authenticator App enabled successfully" });
  } catch (error) {
    console.error('TOTP Verification Error:', error);
    res.status(500).json({ error: "Failed to verify TOTP" });
  }
});

/**
 * Skip MFA for the current session or suppress for 7 days
 */
router.post("/mfa/skip", authRequired, async (req, res) => {
  try {
    const { permanent } = req.body;
    const userId = req.user.uid;

    // Mark as verified for THIS session
    req.session.mfaVerifiedAt = new Date().toISOString();

    if (permanent) {
      // Suppress onboarding for 7 days
      const skipUntil = new Date();
      skipUntil.setDate(skipUntil.getDate() + 7);

      const user = await getDoc('users', userId);
      await setDoc('users', userId, {
        ...user,
        mfaSetupSkippedUntil: skipUntil.toISOString()
      });
    }

    res.json({ success: true, message: permanent ? "MFA onboarding suppressed for 7 days" : "MFA skipped for this session" });
  } catch (error) {
    console.error('MFA Skip Error:', error);
    res.status(500).json({ error: "Failed to process request" });
  }
});

router.post("/2fa/send-code", authRequired, async (req, res) => {
  try {
    const userId = req.user.uid;
    const user = await getDoc('users', userId);
    if (!user || !user.email) return res.status(404).json({ error: "User/Email not found" });

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

    // Store code in secure collection
    await setDoc('mfaSecrets', userId, {
      emailCode: {
        code,
        expiry,
        attempts: 0
      },
      updatedAt: new Date().toISOString()
    });

    const { sendEmail } = require('../utils/emailService');
    await sendEmail({ to: user.email, subject: 'Your 2FA Code', html: `<p>Your verification code is: <b>${code}</b></p><p>This code expires in 10 minutes.</p>` });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "Failed to send code" }); }
});

router.post("/2fa/verify-code", authRequired, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { code } = req.body;
    const secretDoc = await getDoc('mfaSecrets', userId);
    const secret = secretDoc?.emailCode;

    if (!secret) return res.status(400).json({ error: "Invalid request or session expired" });

    // SECURITY: Check code expiry
    if (secret.expiry && new Date(secret.expiry) < new Date()) {
      await setDoc('users', userId, { ...user, _twoFactorSecret: null });
      return res.status(400).json({ error: "Code expired. Please request a new code." });
    }

    // SECURITY: Rate limiting
    const failedAttempts = secret.attempts || 0;
    if (failedAttempts >= 5) {
      await setDoc('users', userId, { ...user, _twoFactorSecret: null });
      return res.status(429).json({ error: "Too many failed attempts. Please request a new code." });
    }

    if (secret.code !== code) {
      await setDoc('mfaSecrets', userId, {
        ...secretDoc,
        emailCode: { ...secret, attempts: failedAttempts + 1 }
      });
      return res.status(400).json({ error: "Invalid code" });
    }

    // Success
    const user = await getDoc('users', userId);
    await setDoc('users', userId, {
      ...user,
      twoFactorVerifiedAt: new Date().toISOString()
    });

    // Clear the verification code
    await setDoc('mfaSecrets', userId, {
      ...secretDoc,
      emailCode: null
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "Verification failed" }); }
});

router.get("/me", authRequired, async (req, res) => {
  const user = await getDoc('users', req.user.uid);
  res.json({ user });
});

router.get("/account", authRequired, async (req, res) => {
  const user = await getDoc('users', req.user.uid);
  res.json({ ...user, isImpersonating: !!req.user.isImpersonating });
});

const { validateRequest, accountUpdateSchema } = require("../utils/validation");

router.put("/account", authRequired, validateRequest(accountUpdateSchema), async (req, res) => {
  const userId = req.user.uid;
  const existing = await getDoc('users', userId);

  if (!existing) {
    return res.status(404).json({ error: "User not found" });
  }

  // Schema filters input, but we rely on existing structure
  const allowedUpdates = req.body;

  const updated = {
    ...existing,
    ...allowedUpdates,
    id: userId, // Ensure ID doesn't change
    updatedAt: new Date().toISOString()
  };

  // Double check sensitive fields are not overwritten even if schema missed them
  if (existing.email) updated.email = existing.email; // Prevent email change
  if (existing.role) updated.role = existing.role;
  if (existing.businessId) updated.businessId = existing.businessId;

  await setDoc('users', userId, updated);
  res.json({ success: true, user: updated });
});

// SMTP Settings
router.get("/account/smtp", authRequired, async (req, res) => {
  try {
    const userId = req.user.uid;
    const user = await getDoc('users', userId);
    // Return SMTP settings or empty object
    res.json(user?.smtpSettings || {
      host: "",
      port: 587,
      user: "",
      pass: "",
      secure: false
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch SMTP settings" });
  }
});

router.put("/account/smtp", authRequired, async (req, res) => {
  try {
    const userId = req.user.uid;
    const smtpSettings = req.body;

    // Basic validation
    if (!smtpSettings.host || !smtpSettings.user) {
      return res.status(400).json({ error: "Host and User are required" });
    }

    const user = await getDoc('users', userId);
    await setDoc('users', userId, {
      ...user,
      smtpSettings,
      updatedAt: new Date().toISOString()
    });

    res.json({ success: true, message: "SMTP settings saved" });
  } catch (error) {
    res.status(500).json({ error: "Failed to save SMTP settings" });
  }
});

const claimsManager = require("../utils/claimsManager");

// Switch Active Tenant
router.post("/switch-tenant", authRequired, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { tenantId } = req.body;

    if (!tenantId) return res.status(400).json({ error: "Tenant ID is required" });

    // switchTenant verifies membership before updating claims
    const result = await claimsManager.switchTenant(userId, tenantId);

    // Update session
    req.session.businessId = tenantId;
    req.session.save();

    res.json({
      success: true,
      tenantId: result.tenantId,
      role: result.role,
      message: "Context switched successfully. Please refresh your token."
    });
  } catch (error) {
    console.error("Switch Tenant Error:", error);
    res.status(403).json({ error: error.message });
  }
});

// List User Workspaces
router.get("/workspaces", authRequired, async (req, res) => {
  try {
    const userId = req.user.uid;

    // 1. Get businesses where user is owner
    const ownedSnap = await getCollectionRef('businesses').where('ownerId', '==', userId).get();
    const owned = ownedSnap.docs.map(d => ({ id: d.id, role: 'owner', ...d.data() }));

    // 2. Get businesses where user is a member
    const memberSnap = await getCollectionRef('members')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();

    const memberships = [];
    for (const doc of memberSnap.docs) {
      const m = doc.data();
      if (m.role === 'owner') continue; // Already covered
      const b = await getDoc('businesses', m.businessId);
      if (b) memberships.push({ id: b.id, role: m.role, ...b });
    }

    const workspaces = [...owned, ...memberships];
    res.json({ data: workspaces });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch workspaces" });
  }
});

module.exports = router;
