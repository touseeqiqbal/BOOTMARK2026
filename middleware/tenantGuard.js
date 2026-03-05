const businessService = require('../utils/BusinessService');

/**
 * Tenant Isolation Guard
 * This middleware resolves the tenant slug from the URL and verifies
 * that the authenticated user has permission to access this business.
 */
exports.tenantGuard = async (req, res, next) => {
    try {
        const { tenantSlug } = req.params;
        const userId = req.user?.uid || req.user?.id;

        if (!tenantSlug) return next(); // Not a slug-based route

        // 1. Resolve Slug to Business
        const business = await businessService.getBusinessBySlug(tenantSlug);
        if (!business) {
            return res.status(404).json({
                error: "Workspace not found",
                code: "invalid_tenant"
            });
        }

        // 2. Authorization Check
        // Security: We check if the user is the owner OR a member
        const isOwner = business.ownerId === userId;
        const isMember = business.members?.some(m => m.userId === userId);

        // SuperAdmin bypass
        if (req.user?.isSuperAdmin) {
            req.tenantId = business.id;
            req.tenant = business;
            return next();
        }

        if (!isOwner && !isMember) {
            console.warn(`[Security] Unauthorized tenant access attempt: User ${userId} tried to access ${tenantSlug}`);
            return res.status(403).json({
                error: "You do not have access to this workspace",
                code: "unauthorized_tenant"
            });
        }

        // 3. Inject Context
        req.tenantId = business.id;
        req.tenant = business;
        req.isTenantOwner = isOwner;

        // Double Check: Ensure req.user.businessId matches if applicable
        // This is a sanity check for users who might try to ID-swap across businesses
        if (!req.user.isSuperAdmin && req.user.businessId && req.user.businessId !== business.id) {
            console.error(`[Security] Context Mismatch: User claimed business ${req.user.businessId} but is accessing ${business.id}`);
            return res.status(403).json({ error: "Session mismatch. Please re-login." });
        }

        next();
    } catch (error) {
        console.error('Tenant Guard Error:', error);
        res.status(500).json({ error: "Internal server error during tenant resolution" });
    }
};
