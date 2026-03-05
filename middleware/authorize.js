/**
 * RBAC Authorization Middleware
 * 
 * Reusable middleware factory for role-based access control.
 * Works alongside existing authRequired middleware.
 * 
 * Usage:
 *   router.post('/invoices', authRequired, authorize(['admin', 'staff']), handler)
 *   router.get('/settings', authRequired, authorize(['admin'], { adminOnly: true }), handler)
 *   router.get('/portal/invoices', authRequired, authorize(['client'], { clientPortal: true }), handler)
 */

const businessService = require('../utils/BusinessService');

/**
 * Role hierarchy for permission checking
 * Higher number = more permissions
 */
const ROLE_HIERARCHY = {
    client: 1,
    staff: 2,
    admin: 3,
    super_admin: 4,
    owner: 4,
};

/**
 * Authorization middleware factory
 * 
 * @param {string[]} allowedRoles - Array of roles allowed to access the endpoint
 *   Valid roles: 'super_admin', 'owner', 'admin', 'staff', 'client'
 * @param {Object} options
 * @param {boolean} options.tenantRequired - Require a valid businessId (default: true)
 * @param {boolean} options.ownerOnly - Only the business owner can access (default: false)
 * @param {boolean} options.clientPortal - This is a client portal endpoint (default: false)
 * @param {boolean} options.selfOnly - User can only access their own resources (default: false)
 */
function authorize(allowedRoles = [], { tenantRequired = true, ownerOnly = false, clientPortal = false, selfOnly = false } = {}) {
    return async (req, res, next) => {
        try {
            // 1. Ensure user is authenticated (authRequired should have run first)
            if (!req.user || !req.user.uid) {
                return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
            }

            const { uid, businessId, isSuperAdmin, isBusinessOwner, businessRole, role } = req.user;

            // 2. Super Admin bypass (can access everything)
            if (isSuperAdmin) {
                req.user.effectiveRole = 'super_admin';
                return next();
            }

            // 3. Determine the user's effective role
            const effectiveRole = resolveEffectiveRole(req.user);
            req.user.effectiveRole = effectiveRole;

            // 4. Check tenant requirement
            if (tenantRequired) {
                // For tenant-slug routes, tenantGuard should have already set req.tenantId
                const resolvedTenantId = req.tenantId || businessId;

                if (!resolvedTenantId) {
                    return res.status(403).json({
                        error: 'No workspace associated with your account',
                        code: 'NO_TENANT'
                    });
                }

                // Ensure user belongs to this tenant
                if (businessId && req.tenantId && businessId !== req.tenantId) {
                    console.warn(`[RBAC] Tenant mismatch: user.businessId=${businessId}, req.tenantId=${req.tenantId}, user=${uid}`);
                    return res.status(403).json({
                        error: 'You do not have access to this workspace',
                        code: 'TENANT_MISMATCH'
                    });
                }
            }

            // 5. Owner-only check
            if (ownerOnly && !isBusinessOwner) {
                console.warn(`[RBAC] Owner-only access denied for user ${uid} (role: ${effectiveRole})`);
                return res.status(403).json({
                    error: 'Only the workspace owner can perform this action',
                    code: 'OWNER_REQUIRED'
                });
            }

            // 6. Role-based access check
            if (allowedRoles.length > 0) {
                const hasPermission = allowedRoles.some(allowedRole => {
                    // Exact match
                    if (effectiveRole === allowedRole) return true;
                    // Hierarchy check: higher roles can do what lower roles can
                    const userLevel = ROLE_HIERARCHY[effectiveRole] || 0;
                    const requiredLevel = ROLE_HIERARCHY[allowedRole] || 0;
                    return userLevel >= requiredLevel;
                });

                if (!hasPermission) {
                    console.warn(`[RBAC] Access denied: user=${uid}, role=${effectiveRole}, required=${allowedRoles.join('|')}`);
                    return res.status(403).json({
                        error: 'Insufficient permissions',
                        code: 'INSUFFICIENT_ROLE',
                        required: allowedRoles,
                        current: effectiveRole
                    });
                }
            }

            // 7. Client portal restrictions
            if (clientPortal && effectiveRole === 'client') {
                // Client portal users have additional restrictions applied by the route handler
                req.isClientPortal = true;
            }

            // 8. Self-only restriction
            if (selfOnly) {
                req.selfOnly = true;
                // The route handler must enforce this by checking req.user.uid against the resource owner
            }

            next();
        } catch (error) {
            console.error('[RBAC] Authorization error:', error);
            return res.status(500).json({ error: 'Authorization check failed', code: 'AUTH_ERROR' });
        }
    };
}

/**
 * Resolve the effective role for a user
 * Takes into account various role fields in the user object
 */
function resolveEffectiveRole(user) {
    if (user.isSuperAdmin) return 'super_admin';
    if (user.isBusinessOwner) return 'owner';

    // Check businessRole first (set by tenantGuard or membership lookup)
    if (user.businessRole) {
        const normalizedRole = user.businessRole.toLowerCase().replace('-', '_');
        if (ROLE_HIERARCHY[normalizedRole]) return normalizedRole;
    }

    // Fallback to role from custom claims or user doc
    if (user.role) {
        const normalizedRole = user.role.toLowerCase().replace('-', '_');
        if (ROLE_HIERARCHY[normalizedRole]) return normalizedRole;
    }

    // Default to staff for authenticated users with a business
    if (user.businessId) return 'staff';

    // No business = no role
    return 'client';
}

/**
 * Convenience middleware: Require admin or above
 */
const requireAdmin = authorize(['admin']);

/**
 * Convenience middleware: Require staff or above
 */
const requireStaff = authorize(['staff']);

/**
 * Convenience middleware: Super admin only
 */
const requireSuperAdmin = authorize(['super_admin'], { tenantRequired: false });

/**
 * Convenience middleware: Client portal access
 */
const clientPortalAccess = authorize(['client'], { clientPortal: true, tenantRequired: false });

/**
 * Step-up Reauthentication Middleware
 * Ensures sensitive actions have a fresh MFA verification (within last 5 mins)
 */
const stepUpRequired = async (req, res, next) => {
    if (!req.user?.isSuperAdmin) {
        return res.status(403).json({ error: 'Super Admin access required' });
    }

    const { mfaVerifiedAt } = req.session || {};
    const FIVE_MINUTES = 5 * 60 * 1000;

    if (!mfaVerifiedAt || (Date.now() - new Date(mfaVerifiedAt).getTime() > FIVE_MINUTES)) {
        return res.status(403).json({
            error: 'Sensitive action: Step-up re-authentication required',
            code: 'STEP_UP_REQUIRED',
            requiresMfa: true
        });
    }

    next();
};

module.exports = {
    authorize,
    requireAdmin,
    requireStaff,
    requireSuperAdmin,
    clientPortalAccess,
    stepUpRequired,
    resolveEffectiveRole,
    ROLE_HIERARCHY
};
