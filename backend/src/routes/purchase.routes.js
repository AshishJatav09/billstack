const express = require("express");

const {
  createPurchase,
  getPurchaseById,
  listPurchases,
} = require("../controllers/purchase.controller");
const { listPurchaseAllocations } = require("../controllers/payment.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireFeature } = require("../middlewares/feature-guard.middleware");
const { requireModule } = require("../middlewares/module-guard.middleware");
const { validateObjectIdParam } = require("../middlewares/object-id.middleware");
const { permit } = require("../middlewares/role.middleware");
const { requireActiveSubscription } = require("../middlewares/subscription.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");
const validate = require("../middlewares/validate.middleware");
const { purchaseCreateValidator } = require("../validators/resource.validation");

const router = express.Router();

router.use(authMiddleware, tenantMiddleware, requireActiveSubscription(), requireFeature("inventory"), requireModule("purchases"));

router.get("/", listPurchases);
router.get("/:purchaseId/allocations", validateObjectIdParam("purchaseId"), listPurchaseAllocations);
router.get("/:purchaseId", validateObjectIdParam("purchaseId"), getPurchaseById);
router.post("/", permit("owner", "admin", "staff", "accountant"), validate(purchaseCreateValidator), createPurchase);

module.exports = router;
