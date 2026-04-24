const express = require("express");

const {
  createSupplier,
  deleteSupplier,
  getSupplierById,
  listSuppliers,
  updateSupplier,
} = require("../controllers/supplier.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireFeature } = require("../middlewares/feature-guard.middleware");
const { validateObjectIdParam } = require("../middlewares/object-id.middleware");
const { permit } = require("../middlewares/role.middleware");
const { requireActiveSubscription } = require("../middlewares/subscription.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  supplierCreateValidator,
  supplierUpdateValidator,
} = require("../validators/resource.validation");

const router = express.Router();

router.use(authMiddleware, tenantMiddleware, requireActiveSubscription(), requireFeature("inventory"));

router.get("/", listSuppliers);
router.get("/:supplierId", validateObjectIdParam("supplierId"), getSupplierById);
router.post("/", permit("owner", "admin", "staff", "accountant"), validate(supplierCreateValidator), createSupplier);
router.put(
  "/:supplierId",
  validateObjectIdParam("supplierId"),
  permit("owner", "admin", "staff", "accountant"),
  validate(supplierUpdateValidator),
  updateSupplier
);
router.delete("/:supplierId", validateObjectIdParam("supplierId"), permit("owner", "admin"), deleteSupplier);

module.exports = router;
