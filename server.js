// Load local `.env` in development (use platform env vars in production)
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config()
  } catch (e) {
    // dotenv may not be installed in some environments; continue gracefully
    console.warn('dotenv not loaded:', e && e.message ? e.message : e)
  }
}

// SECURITY: Validate critical environment variables on startup
// Firebase credentials can be supplied in three ways (checked in priority order):
//   1. FIREBASE_SERVICE_ACCOUNT  — full service-account JSON as a single-line string (Render / Vercel)
//   2. firebase-service-account.json — file in the project root (local dev)
//   3. Individual vars: FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY

const _hasServiceAccountBlob = !!process.env.FIREBASE_SERVICE_ACCOUNT;
const _hasServiceAccountFile = (() => { try { return require('fs').existsSync(require('path').join(__dirname, 'firebase-service-account.json')); } catch { return false; } })();
const _hasFirebaseCredentials = _hasServiceAccountBlob || _hasServiceAccountFile;

// Only require the individual vars when the blob/file alternatives are absent
const REQUIRED_ALWAYS = ['SESSION_SECRET', 'JWT_SECRET'];
const REQUIRED_IF_NO_BLOB = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];

const missingVars = [
  ...REQUIRED_ALWAYS.filter(v => !process.env[v]),
  ...(_hasFirebaseCredentials ? [] : REQUIRED_IF_NO_BLOB.filter(v => !process.env[v]))
];

if (missingVars.length > 0) {
  const isProd = process.env.NODE_ENV === 'production';
  const errorMessage = `CRITICAL CONFIGURATION ERROR: Missing required environment variables: ${missingVars.join(', ')}`;

  if (isProd) {
    console.error('\x1b[31m%s\x1b[0m', errorMessage);
    console.error('The server cannot start in production without these. Please check your platform environment settings.');
    process.exit(1);
  } else {
    console.warn('\x1b[33m%s\x1b[0m', '--- WARNING: MISSING CONFIGURATION ---');
    console.warn('\x1b[33m%s\x1b[0m', errorMessage);
    console.warn('\x1b[33m%s\x1b[0m', 'Using default/insecure values for development. DO NOT DEPLOY TO PRODUCTION LIKE THIS.');
    console.warn('\x1b[33m%s\x1b[0m', '--- ------------------------------ ---');
  }
}

if (_hasServiceAccountBlob) {
  console.log('✅ Firebase credentials: FIREBASE_SERVICE_ACCOUNT environment variable');
} else if (_hasServiceAccountFile) {
  console.log('✅ Firebase credentials: firebase-service-account.json file');
} else {
  console.log('✅ Firebase credentials: individual FIREBASE_* environment variables');
}

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const path = require("path");
const fs = require("fs");

const formsRouter = require("./routes/forms");
const workspacesRouter = require("./routes/workspaces");
const publicRouter = require("./routes/public");
const authRouter = require("./routes/auth");
const packagesRouter = require("./routes/packages");
const submissionsRouter = require("./routes/submissions");
const quickbooksRouter = require("./routes/quickbooks");
const { router: customersRouter } = require("./routes/customers");
const invoicesRouter = require("./routes/invoices");
const businessesRouter = require("./routes/businesses");
const paymentsRouter = require("./routes/payments");
const { router: propertiesRouter } = require("./routes/properties");
const workOrdersRouter = require("./routes/workOrders");
const workOrderTemplatesRouter = require("./routes/workOrderTemplates");
const workOrderFormSettingsRouter = require("./routes/workOrderFormSettings");
const servicesRouter = require("./routes/services");
const productsRouter = require("./routes/products");
const contractsRouter = require("./routes/contracts");
const contractTemplatesRouter = require("./routes/contractTemplates");
const publicContractsRouter = require("./routes/publicContracts");
const estimatesRouter = require("./routes/estimates");
const schedulingRouter = require("./routes/scheduling");
const employeesRouter = require("./routes/employees");
const materialsRouter = require("./routes/materials");
const reportsRouter = require("./routes/reports");
const settingsRouter = require("./routes/settings");
const clientsRouter = require("./routes/clients"); // NEW: Client portal routes
const clientInvitationsRouter = require("./routes/clientInvitations"); // NEW: Client invitations
const serviceRequestsRouter = require("./routes/serviceRequests"); // NEW: Service requests
const messagesRouter = require("./routes/messages"); // NEW: Messages
const gpsRouter = require("./routes/gps"); // NEW: GPS tracking
const remindersRouter = require("./routes/reminders"); // NEW: Automated reminders
const usersRouter = require("./routes/users"); // NEW: Unified users endpoint
const workflowsRouter = require("./routes/workflows"); // NEW: Custom Workflows
const onboardingRouter = require("./routes/onboarding"); // NEW: User onboarding
const notificationsRouter = require("./routes/notifications"); // NEW: Notifications system
const automationsRouter = require("./routes/automations"); // NEW: Advanced Automations
const marketplaceRouter = require("./routes/marketplace"); // NEW: Template Marketplace
const auditHistoryRouter = require("./routes/auditHistory"); // NEW: Audit History
const auditLogger = require("./middleware/auditLogger"); // NEW: Audit Logging
const platformRouter = require("./routes/platform"); // NEW: Platform Oversight
const systemRouter = require("./routes/system"); // NEW: System Health
const { authRequired } = require("./middleware/auth");
const authorize = require("./middleware/authorize");
const { requireSuperAdmin } = authorize;
const { tenantGuard } = require("./middleware/tenantGuard");
const { apiLimiter, authLimiter, publicLimiter } = require("./middleware/rateLimiter"); // Rate limiting
const helmet = require("helmet"); // Security headers
const compression = require("compression"); // Response compression
const errorHandler = require("./middleware/errorHandler"); // NEW: Global error handler
const requestId = require("./middleware/requestId"); // Request tracing
const logger = require("./utils/logger"); // NEW: Structured logging

const app = express();
const PORT = process.env.PORT || 4000;

// Configure CORS to allow credentials (cookies)
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : (process.env.NODE_ENV === 'production' ? ['https://bootmarkapp.com', 'https://www.bootmarkapp.com'] : true);

app.use(cors({
  origin: corsOrigin,
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Business-ID']
}));

// Security: Reduce body size limits to prevent abuse (was 50mb — DoS risk)
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Performance: Enable gzip/brotli compression for all responses
app.use(compression());

// Tracing: Attach unique request ID for log correlation
app.use(requestId);
app.use(cookieParser());

// Configure session middleware with Firestore-backed store (production-safe)
// Falls back to MemoryStore only if Firestore is not available (e.g. local dev without credentials)
let sessionStore;
try {
  const FirestoreSessionStore = require('./utils/FirestoreSessionStore');
  const FSStore = new FirestoreSessionStore(session);
  sessionStore = new FSStore();
  console.log('✅ Session store: Firestore');
} catch (e) {
  console.warn('⚠️  Session store: MemoryStore (Firestore unavailable):', e.message);
}

app.use(session({
  store: sessionStore, // undefined = default MemoryStore (dev only)
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || "development-session-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS attacks
    maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' // CSRF protection
  },
  name: 'sessionId' // Custom session cookie name
}));

// Add request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    userId: req.user?.uid || req.user?.id,
    ip: req.ip
  });
  next();
});

// Security: Helmet middleware for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",  // Required for inline scripts in HTML
        "https://www.googletagmanager.com",  // Google Analytics
        "https://www.google-analytics.com",
        "https://apis.google.com"            // Firebase Auth (Google Sign-In)
      ],
      imgSrc: ["'self'", "data:", "https:", "https://www.google-analytics.com"],
      connectSrc: [
        "'self'",
        "https://identitytoolkit.googleapis.com",  // Firebase Auth
        "https://securetoken.googleapis.com",      // Firebase Auth tokens
        "https://firebase.googleapis.com",         // Firebase config
        "https://firebaseinstallations.googleapis.com",  // Firebase installations
        "https://www.google-analytics.com",        // Google Analytics
        "https://analytics.google.com",            // Google Analytics
        "wss://*.firebaseio.com",                  // Firebase Realtime Database
        "https://*.firebaseio.com"                 // Firebase Realtime Database
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: [
        "https://bootmarkapp.firebaseapp.com",  // Firebase Auth iframe
        "https://accounts.google.com"           // Google Sign-In
      ]
    }
  },
  crossOriginEmbedderPolicy: false // Allow embedding if needed
}));

console.log('✅ Security headers enabled (Helmet)');

// RATE LIMITING
// Enable in all environments to prevent abuse, but allow higher limits in dev
app.use('/api/', apiLimiter);
console.log('✅ API rate limiting enabled');
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
console.log('✅ Auth rate limiting enabled');
app.use('/api/public/', publicLimiter);
console.log('✅ Public rate limiting enabled');

// Enforce strong session secret in production
if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'development-session-secret-change-in-production')) {
  console.error('❌ CRITICAL: Insecure SESSION_SECRET found in production environment!');
  process.exit(1);
}

// Public health check — safe for load balancers/uptime monitors
// SECURITY: No env vars, paths, or internal details exposed
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// Global Audit Logger (captures mutations)
app.use(auditLogger);

// ========================================
// API ROUTES
// ========================================

// 1. Global (Non-Tenant) API Routes
app.use("/api/auth", authRouter);
app.use("/api/packages", packagesRouter);
app.use("/api/businesses", authRequired, businessesRouter);
app.use("/api/public", publicRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/quickbooks", authRequired, quickbooksRouter);
app.use("/api/client-invitations", clientInvitationsRouter);
app.use("/api/admin-support", require('./routes/admin-support'));
app.use("/api/platform", platformRouter);
app.use("/api/webhooks", require('./routes/webhooks'));
app.use("/api/system", authRequired, authorize.requireSuperAdmin, systemRouter);
app.use("/api/clients", authRequired, clientsRouter);

// 2. Tenant-Scoped API Routes
// These routes require :tenantSlug and will be guarded
const tenantRouter = express.Router({ mergeParams: true });
tenantRouter.use(authRequired);
tenantRouter.use(tenantGuard);

// Mount business-specific modules
tenantRouter.use("/forms", formsRouter);
tenantRouter.use("/workspaces", workspacesRouter);
tenantRouter.use("/submissions", submissionsRouter);
tenantRouter.use("/customers", customersRouter);
tenantRouter.use("/properties", propertiesRouter);
tenantRouter.use("/work-orders", workOrdersRouter);
tenantRouter.use("/work-order-templates", workOrderTemplatesRouter);
tenantRouter.use("/services", servicesRouter);
tenantRouter.use("/products", productsRouter);
tenantRouter.use("/contracts", contractsRouter);
tenantRouter.use("/contract-templates", contractTemplatesRouter);
tenantRouter.use("/estimates", estimatesRouter);
tenantRouter.use("/scheduling", schedulingRouter);
tenantRouter.use("/employees", employeesRouter);
tenantRouter.use("/materials", materialsRouter);
tenantRouter.use("/reports", reportsRouter);
tenantRouter.use("/settings", settingsRouter);
tenantRouter.use("/invoices", invoicesRouter);
tenantRouter.use("/service-requests", serviceRequestsRouter);
tenantRouter.use("/messages", messagesRouter);
tenantRouter.use("/gps", gpsRouter);
tenantRouter.use("/reminders", remindersRouter);
tenantRouter.use("/users", usersRouter);
tenantRouter.use("/workflows", workflowsRouter);
tenantRouter.use("/onboarding", onboardingRouter);
tenantRouter.use("/notifications", notificationsRouter);
tenantRouter.use("/automations", automationsRouter);
tenantRouter.use("/marketplace", marketplaceRouter);
tenantRouter.use("/audit-history", auditHistoryRouter);
tenantRouter.use("/work-order-form-settings", workOrderFormSettingsRouter);

app.use("/api/:tenantSlug", tenantRouter);

// ========================================
// SERVE MARKETING SITE
// ========================================
// Explicitly handle root path to serve marketing site
const marketingDir = path.join(__dirname, "marketing-site");
const marketingIndexPath = path.join(marketingDir, "index.html");

// Serve marketing site index.html at root
app.get('/', (req, res, next) => {
  if (fs.existsSync(marketingIndexPath)) {
    return res.sendFile(path.resolve(marketingIndexPath));
  }
  next();
});

// Serve marketing site static files (HTML, CSS, JS, images)
if (fs.existsSync(marketingDir)) {
  // Serve marketing site files with proper MIME types
  app.use(express.static(marketingDir, {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
    etag: true,
    lastModified: true,
    index: false // Don't auto-serve index.html (we handle it explicitly above)
  }));
  console.log('✅ Marketing site enabled at root URL');
} else {
  console.warn('⚠️  Marketing site directory not found');
}

// ========================================
// SERVE MAIN APP (React SPA)
// ========================================

// Serve static files from public/dist in production, or public in development
const publicDir = path.join(__dirname, "public");
const distDir = path.join(publicDir, "dist");

// Check if dist directory exists (production build)
const staticDir = fs.existsSync(distDir) ? distDir : publicDir;

// Serve static assets with caching
app.use(express.static(staticDir, {
  maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0',
  etag: true,
  lastModified: true
}));

// Serve index.html for all non-API routes (SPA routing)
// Express 5 doesn't support "*" wildcard - use app.use() without path pattern
// This middleware will catch all remaining routes after static files
app.use((req, res, next) => {
  // Skip API routes (should already be handled, but double-check)
  if (req.path.startsWith("/api")) {
    return next();
  }

  // Skip static file requests (they should be handled by static middleware)
  if (req.path.match(/\.(js|css|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|json|map)$/)) {
    return next();
  }

  // Only handle GET requests for SPA routing
  if (req.method !== "GET") {
    return next();
  }

  // Define app routes (these should serve the React app)
  const appRoutes = [
    '/login',
    '/register',
    '/dashboard',
    '/admin',           // Super admin panel
    '/choose-business',
    '/choose-role',
    '/business-registration',
    '/account-review',
    '/mfa-onboarding',
    '/verify-email',
    '/verify-2fa',
    '/forgot-password',
    '/reset-password',
    '/accept-invite',
    '/notifications',
    '/marketplace',
    '/forms',
    '/workspaces',
    '/submissions',
    '/customers',
    '/properties',
    '/work-orders',
    '/scheduling',
    '/invoices',
    '/estimates',
    '/contracts',
    '/employees',
    '/materials',
    '/reports',
    '/analytics',
    '/services',
    '/products',
    '/employees',
    '/crew-mobile',
    '/quickbooks',
    '/business-reports',
    '/audit-log',
    '/system-health',
    '/account-settings',
    '/app-customization',
    '/user-management',
    '/number-format-settings',
    '/job-workflows',
    '/automations',
    '/settings',
    '/client-portal',
    '/client',
    '/profile',
    '/share',
    '/pay',
    '/contracts',
  ];

  // Check if this is an app route
  const isAppRoute = appRoutes.some(route => req.path.startsWith(route));

  if (isAppRoute) {
    // Serve React app index.html for app routes
    const indexPath = fs.existsSync(distDir)
      ? path.join(distDir, "index.html")
      : path.join(publicDir, "index.html");

    if (fs.existsSync(indexPath)) {
      return res.sendFile(path.resolve(indexPath));
    }
  } else {
    // Serve marketing site index.html for root and other routes
    const marketingIndexPath = path.join(marketingDir, "index.html");
    if (fs.existsSync(marketingIndexPath)) {
      return res.sendFile(path.resolve(marketingIndexPath));
    }
  }

  // Fallback for development
  return res.status(404).send("File not found");
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Only start server if not in Vercel environment
if (process.env.VERCEL !== '1') {
  const http = require('http');
  const server = http.createServer(app);

  // Initialize Socket.IO for real-time features
  const { initializeSocket } = require('./utils/socketServer');
  initializeSocket(server);

  server.listen(PORT, () => {
    logger.info(`Server listening on http://localhost:${PORT}`);
    logger.info('Real-time notifications enabled (Socket.IO)');

    // Initialize automated reminder scheduler
    const { initializeReminderScheduler } = require('./utils/reminderScheduler');
    initializeReminderScheduler();
  });
} else {
  // Vercel serverless - no Socket.IO
  app.listen(PORT, () => {
    logger.info(`Server listening on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;

// PRODUCTION HARDENING: Graceful Shutdown
// Handles termination signals to close server and connections cleanly
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  if (typeof httpServer !== 'undefined' && httpServer.listening) {
    httpServer.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });

    // Force close after 10s if connections persist
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
