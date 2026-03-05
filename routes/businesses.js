const express = require("express");
const path = require("path");
const businessService = require("../utils/BusinessService");
const { getAllPermissionIds, BUSINESS_PERMISSIONS, getPermissionsByCategory } = require("../utils/businessPermissions");
const { getDoc, getCollectionRef, deleteDoc } = require("../utils/db");
const { authorize, requireAdmin, requireSuperAdmin } = require('../middleware/authorize');
const auditService = require('../utils/EnhancedAuditService');
const { validateRequest, businessUpdateSchema, memberCreateSchema } = require('../utils/validation');

const router = express.Router();

async function verifySuperAdmin(req) {
  const userId = req.user?.uid || req.user?.id;
  const user = await getDoc('users', userId);
  if (!user?.isSuperAdmin) {
    const err = new Error("Super Admin required");
    err.status = 403;
    throw err;
  }
  return user;
}

// Get available permissions (for permission selector)
// Moved to top to avoid any route conflicts
router.get("/permissions/available", async (req, res) => {
  try {
    // Return all available permissions organized by category
    const byCategory = getPermissionsByCategory();
    const permissions = {};

    // Flatten permissions for easy lookup
    Object.values(byCategory).forEach(categoryPerms => {
      categoryPerms.forEach(perm => {
        permissions[perm.id] = perm;
      });
    });

    res.json({
      permissions,
      byCategory
    });
  } catch (error) {
    console.error('Error fetching available permissions:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/register", async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    const business = await businessService.registerBusiness(userId, req.body);
    res.json({ success: true, business });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/my-business", async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    const user = await getDoc('users', userId);
    let business = user?.businessId ? await businessService.getBusinessById(user.businessId) : null;
    if (!business) business = await businessService.getBusinessByOwnerId(userId);

    if (!business) return res.status(404).json({ error: "Business not found" });
    res.json(business);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch business" });
  }
});

router.get("/slug/:slug", async (req, res) => {
  try {
    const business = await businessService.getBusinessBySlug(req.params.slug);
    if (!business) return res.status(404).json({ error: "Business not found" });
    res.json(business);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch business by slug" });
  }
});

router.get("/my-membership", async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    const { getDoc, getCollectionRef } = require("../utils/db");

    // Aggregate businesses from multiple sources to ensure enterprise-scale reliability
    const businessMap = new Map();

    // 1. Get businesses where user is the OWNER
    const ownedSnap = await getCollectionRef('businesses')
      .where('ownerId', '==', userId)
      .get();

    ownedSnap.forEach(doc => {
      const data = doc.data();
      businessMap.set(doc.id, {
        id: doc.id,
        businessId: doc.id,
        name: data.name,
        slug: data.slug,
        role: 'owner',
        status: data.status || 'active'
      });
    });

    // 2. Get businesses from the MEMBERSHIPS collection
    const membershipsSnap = await getCollectionRef('memberships')
      .where('userId', '==', userId)
      .get();

    for (const doc of membershipsSnap.docs) {
      const memData = doc.data();
      if (!businessMap.has(memData.businessId)) {
        const business = await businessService.getBusinessById(memData.businessId);
        if (business) {
          businessMap.set(memData.businessId, {
            id: business.id || memData.businessId,
            businessId: memData.businessId,
            name: business.name,
            slug: business.slug,
            role: memData.role || 'member',
            status: business.status || 'active'
          });
        }
      }
    }

    // 3. Fallback: Check the Direct Link on User Profile
    const userDoc = await getDoc('users', userId);
    if (userDoc?.businessId && !businessMap.has(userDoc.businessId)) {
      const business = await businessService.getBusinessById(userDoc.businessId);
      if (business) {
        businessMap.set(userDoc.businessId, {
          id: business.id || userDoc.businessId,
          businessId: userDoc.businessId,
          name: business.name,
          slug: business.slug,
          role: userDoc.role || 'owner',
          status: business.status || 'active'
        });
      }
    }

    // Convert map to deduplicated array
    const memberships = Array.from(businessMap.values());

    // Audit/Logging for Super Admin access
    if (userDoc?.isSuperAdmin) {
      console.log(`[SuperAdmin] Resolved ${memberships.length} businesses for ${userDoc.email}`);
    } else {
      console.log(`[MyMembership Debug] Resolved ${memberships.length} businesses for user ${userId}`, memberships);
    }

    res.json(memberships);
  } catch (error) {
    console.error("[MyMembership Error] Error fetching memberships:", error);
    res.status(500).json({ error: "Failed to fetch memberships" });
  }
});

router.put("/update", requireAdmin, validateRequest(businessUpdateSchema), async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    const user = await getDoc('users', userId);
    const businessId = user?.businessId || req.body.businessId;
    const updated = await businessService.updateBusiness(businessId, req.body, userId, user?.isSuperAdmin);
    auditService.log(req, 'business.updated', 'business', businessId, {}, { updatedBy: userId }).catch(() => { });
    res.json({ success: true, business: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/members", async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    const user = await getDoc('users', userId);
    const business = await businessService.getBusinessById(user?.businessId);
    if (!business) return res.status(404).json({ error: "Business not found" });

    const members = [];
    const owner = await getDoc('users', business.ownerId);
    if (owner) members.push({ userId: business.ownerId, email: owner.email, name: owner.name, role: 'owner', isOwner: true });

    for (const m of (business.members || [])) {
      if (m.userId === business.ownerId) continue;
      const u = await getDoc('users', m.userId);
      members.push({ ...m, user: u ? { name: u.name, email: u.email } : null });
    }
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

router.post("/members/create", requireAdmin, validateRequest(memberCreateSchema), async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    const user = await getDoc('users', userId);
    const result = await businessService.createMember(user.businessId, userId, req.body);
    auditService.log(req, 'business.memberCreated', 'business', user.businessId, {}, { memberEmail: req.body.email }).catch(() => { });
    res.json({ success: true, member: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/members/:memberId", async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    const user = await getDoc('users', userId);
    await businessService.removeMember(user.businessId, req.params.memberId);
    auditService.log(req, 'business.memberRemoved', 'business', user.businessId, {}, { memberId: req.params.memberId }).catch(() => { });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// Admin
router.get("/all", async (req, res) => {
  try {
    await verifySuperAdmin(req);
    const businesses = await businessService.getAllBusinesses();
    res.json(businesses);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get("/pending-approvals", async (req, res) => {
  try {
    await verifySuperAdmin(req);
    const snap = await getCollectionRef('businesses').where('status', '==', 'pending-review').get();
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    res.json(items);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post("/:businessId/approve", async (req, res) => {
  try {
    const adminUser = await verifySuperAdmin(req);
    const business = await businessService.approveBusiness(req.params.businessId, adminUser.id, req.body.permissions);
    auditService.logPlatformEvent('business.approved', adminUser.id, { entityType: 'business', entityId: req.params.businessId }).catch(() => { });
    res.json({ success: true, business });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get("/:businessId/permissions", async (req, res) => {
  try {
    await verifySuperAdmin(req);
    const admins = await businessService.getBusinessAdmins(req.params.businessId);
    res.json({ admins });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.put("/:businessId/permissions/:userId", async (req, res) => {
  try {
    await verifySuperAdmin(req);
    const updated = await businessService.updateUserPermissions(req.params.userId, req.body.permissions);
    res.json({ success: true, permissions: updated.businessPermissions });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.delete("/:businessId", async (req, res) => {
  try {
    await verifySuperAdmin(req);
    await businessService.deleteBusiness(req.params.businessId);
    auditService.logPlatformEvent('business.deleted', req.user?.uid, { entityType: 'business', entityId: req.params.businessId }).catch(() => { });
    res.json({ success: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post("/members/:userId/reset-password", async (req, res) => {
  try {
    await verifySuperAdmin(req);
    const result = await businessService.resetUserPassword(req.params.userId);
    auditService.logPlatformEvent('user.passwordReset', req.user?.uid, { entityType: 'user', entityId: req.params.userId }).catch(() => { });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

module.exports = router;
