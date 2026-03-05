// Use Firebase Admin from utils/db.js if available
// This prevents double initialization which causes authentication errors
let firebaseInitialized = false;
let admin = null;

try {
  // Try to get the already-initialized Firebase Admin from utils/db.js
  const { admin: dbAdmin, useFirestore } = require("../utils/db");

  if (dbAdmin && dbAdmin.apps && dbAdmin.apps.length > 0) {
    // Firebase Admin is already initialized in utils/db.js
    admin = dbAdmin;
    firebaseInitialized = true;
    console.log("✅ Using Firebase Admin from utils/db.js in middleware");
  } else if (useFirestore && dbAdmin) {
    // Firestore is available but might not have apps yet - still use it
    admin = dbAdmin;
    firebaseInitialized = true;
    console.log("✅ Using Firebase Admin from utils/db.js in middleware (Firestore enabled)");
  }
} catch (error) {
  // If utils/db.js doesn't have Firebase initialized, try to initialize here
  // This is a fallback for cases where db.js hasn't loaded yet
  try {
    admin = require("firebase-admin");

    // Check if already initialized
    if (admin.apps && admin.apps.length > 0) {
      firebaseInitialized = true;
      console.log("✅ Using existing Firebase Admin instance in middleware");
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Initialize only if not already initialized
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

      // Ensure private_key has proper newlines
      if (serviceAccount.private_key && serviceAccount.private_key.includes('\\n')) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      firebaseInitialized = true;
      console.log("✅ Firebase Admin initialized in middleware");
    } else if (process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      firebaseInitialized = true;
      console.log("✅ Firebase Admin initialized in middleware (default credentials)");
    }
  } catch (initError) {
    console.warn("⚠️  Firebase Admin not initialized in middleware. Using fallback.");
    console.warn("   Error:", initError.message);
  }
}

// Fallback: ensure admin is loaded even if initialization failed
if (!admin) {
  admin = require("firebase-admin");
}

exports.authRequired = async (req, res, next) => {
  try {
    // Check if user is authenticated via session
    if (req.session && req.session.authenticated && req.session.userId) {
      let activeUserId = req.session.userId;
      let isImpersonating = false;

      // 🕵️ IMPERSONATION CHECK
      if (req.session.impersonateUserId) {
        activeUserId = req.session.impersonateUserId;
        isImpersonating = true;
        req.adminId = req.session.userId; // Store original admin for auditing
        console.log(`[Impersonation] Admin ${req.adminId} acting as User ${activeUserId}`);
      }

      req.user = {
        id: activeUserId,
        uid: activeUserId,
        email: isImpersonating ? req.session.impersonateUserEmail : req.session.userEmail,
        isImpersonating
      };

      // Fetch business context from Firestore
      if (firebaseInitialized && admin.firestore) {
        try {
          const db = admin.firestore();
          const userDoc = await db.collection('users').doc(activeUserId).get();

          if (userDoc.exists) {
            const userData = userDoc.data();

            // 🔍 TENANT SUSPENSION CHECK
            if (userData.businessId && !userData.isSuperAdmin && !isImpersonating) {
              const businessDoc = await db.collection('businesses').doc(userData.businessId).get();
              if (businessDoc.exists) {
                const businessData = businessDoc.data();
                if (businessData.status === 'suspended') {
                  return res.status(403).json({
                    error: "Your workspace has been suspended. Please contact support.",
                    code: "TENANT_SUSPENDED",
                    reason: businessData.suspensionReason || 'Maintenance'
                  });
                }
              }
            }

            // SECURITY: Enforce 2FA if enabled (Skip if impersonating - admin already verified MFA)
            const isMfaVerified = userData.twoFactorVerifiedAt || req.session.mfaVerifiedAt;
            const isMfaEndpoint = req.path.includes('/2fa') || req.path.includes('/mfa');

            if (!isImpersonating && userData.twoFactorEnabled && !isMfaVerified && !isMfaEndpoint) {
              return res.status(401).json({
                error: "2fa_required",
                method: userData.twoFactorMethod || 'email'
              });
            }

            req.user = {
              ...req.user,
              businessId: userData.businessId || (isImpersonating ? null : req.session.businessId) || null,
              businessPermissions: userData.businessPermissions || [],
              isSuperAdmin: !isImpersonating && (userData.isSuperAdmin === true),
              isBusinessOwner: userData.isBusinessOwner === true,
              businessRole: userData.businessRole || null,
              accountStatus: userData.accountStatus || 'active'
            };
          }
        } catch (firestoreError) {
          console.warn('Failed to fetch user business context:', firestoreError.message);
        }
      }

      return next();
    }

    // Fallback to token-based authentication
    // Prioritize Authorization header over cookies to ensure fresh tokens are used
    const token = req.headers?.authorization?.replace("Bearer ", "") || req.cookies?.token;

    if (!token) {
      console.log("No token or session found in request");
      return res.status(401).json({ error: "Authentication required" });
    }

    console.log("Token received, length:", token.length);

    let userId = null;
    let userEmail = null;

    // Try Firebase token verification first
    if (firebaseInitialized) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        userId = decodedToken.uid;
        userEmail = decodedToken.email;

        req.user = {
          id: userId,
          uid: userId,
          email: userEmail,
          role: decodedToken.role || 'admin', // Extract role from custom claims
          businessId: decodedToken.businessId || null, // Extract businessId from custom claims
          customerId: decodedToken.customerId || null // Extract customerId from custom claims (for clients)
        };

        // Fetch full user data from Firestore including business context
        if (admin.firestore) {
          try {
            const db = admin.firestore();
            const userDoc = await db.collection('users').doc(userId).get();

            if (userDoc.exists) {
              const userData = userDoc.data();

              // 🔍 TENANT SUSPENSION CHECK (Token Path)
              if (userData.businessId && !userData.isSuperAdmin) {
                const businessDoc = await db.collection('businesses').doc(userData.businessId).get();
                if (businessDoc.exists) {
                  const businessData = businessDoc.data();
                  if (businessData.status === 'suspended') {
                    return res.status(403).json({
                      error: "Your workspace has been suspended. Please contact support.",
                      code: "TENANT_SUSPENDED",
                      reason: businessData.suspensionReason || 'Maintenance'
                    });
                  }
                }
              }

              req.user = {
                ...req.user,
                businessId: req.user.businessId || userData.businessId || null, // Prefer custom claim
                businessPermissions: userData.businessPermissions || [],
                isSuperAdmin: userData.isSuperAdmin === true,
                isBusinessOwner: userData.isBusinessOwner === true,
                businessRole: userData.businessRole || null,
                accountStatus: userData.accountStatus || 'active',
                name: userData.name || null
              };

              // SECURITY: Enforce 2FA if enabled (Token-based)
              const isMfaVerified = userData.twoFactorVerifiedAt || req.session.mfaVerifiedAt;
              const isMfaEndpoint = req.path.includes('/2fa') || req.path.includes('/mfa');

              if (userData.twoFactorEnabled && !isMfaVerified && !isMfaEndpoint) {
                return res.status(401).json({
                  error: "2fa_required",
                  method: userData.twoFactorMethod || 'email'
                });
              }

              // SECURITY FIX: Removed auto-businessId assignment
              // If admin user has no businessId, flag them for onboarding instead of auto-assigning
              if (!req.user.businessId && req.user.role === 'admin') {
                console.warn(`[Auth] Admin user ${userId} has no businessId - requires onboarding`);
                req.user.requiresOnboarding = true;
              }
            }
          } catch (firestoreError) {
            console.warn('Failed to fetch user data from Firestore:', firestoreError.message);
          }
        }

        console.log(`[Auth] User authenticated: ${userEmail} (role: ${req.user.role}, businessId: ${req.user.businessId})`);
        return next();
      } catch (firebaseError) {
        // Log concise warning for auth-related Firebase errors
        if (firebaseError.code && firebaseError.code.startsWith('auth/')) {
          console.warn(`[Auth] Firebase token verification failed (${firebaseError.code})`);

          // Explicit handling for expired tokens: always return 401 so the client can refresh
          if (firebaseError.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: "token_expired", details: firebaseError.message });
          }

          // Other Firebase auth errors
          return res.status(401).json({ error: "invalid_token", details: firebaseError.message });
        } else {
          console.warn("Firebase token verification failed (non-auth error):", firebaseError.message);
        }

        // SECURITY: If Firebase is not configured, do NOT accept unverified tokens
        if (!firebaseInitialized || firebaseError.code === 'app/no-app') {
          console.error("[Auth] Firebase Admin not configured — cannot verify tokens. Rejecting request.");
          return res.status(401).json({ error: "Authentication service unavailable" });
        }
        // Firebase verification failed — try JWT fallback
        console.warn("Trying JWT fallback");
      }
    } else {
      // SECURITY: Firebase Admin not initialized — reject all token-based requests
      console.error("[Auth] Firebase Admin not initialized — cannot verify tokens. Rejecting request.");
      return res.status(401).json({ error: "Authentication service unavailable" });
    }

    // Fallback to JWT (for backward compatibility)
    try {
      const jwt = require("jsonwebtoken");
      const config = require("../config");
      const decoded = jwt.verify(token, config.jwtSecret);
      req.user = decoded;
      next();
    } catch (jwtError) {
      console.error("JWT verification failed:", jwtError.message);
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

/**
 * Middleware to enforce 2FA verification for specific sensitive routes.
 * Unlike authRequired (which only enforces if enabled globally), 
 * this middleware blocks access until 2FA is verified in the current session.
 */
exports.twoFactorRequired = async (req, res, next) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const isVerified = req.session.mfaVerifiedAt || (req.user && req.user.twoFactorVerifiedAt);

    if (isVerified) {
      return next();
    }

    // Check if user has 2FA set up at least
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    return res.status(401).json({
      error: "2fa_required",
      method: userData?.twoFactorMethod || 'email',
      message: "This sensitive report requires two-factor verification."
    });
  } catch (error) {
    console.error("2FA Required Middleware Error:", error);
    res.status(500).json({ error: "Internal server error during 2FA check" });
  }
};
