const express = require("express");

const {
  getSuperAdminOverview,
  listBusinesses,
  superAdminLogin,
  toggleBusinessStatus,
  updateBusinessPlanBySuperAdmin,
} = require("../controllers/super-admin.controller");
const { validateObjectIdParam } = require("../middlewares/object-id.middleware");
const { authRateLimiter } = require("../middlewares/rate-limit.middleware");
const { requireSuperAdmin } = require("../middlewares/super-admin.middleware");

const router = express.Router();

router.post("/login", authRateLimiter, superAdminLogin);
router.get("/overview", requireSuperAdmin, getSuperAdminOverview);
router.get("/businesses", requireSuperAdmin, listBusinesses);
router.post(
  "/businesses/:businessId/toggle-status",
  requireSuperAdmin,
  validateObjectIdParam("businessId"),
  toggleBusinessStatus
);
router.post(
  "/businesses/:businessId/plan",
  requireSuperAdmin,
  validateObjectIdParam("businessId"),
  updateBusinessPlanBySuperAdmin
);

module.exports = router;
