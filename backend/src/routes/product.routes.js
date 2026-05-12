const express = require("express");

const {
  createProduct,
  createProductMovement,
  deleteProduct,
  getProductById,
  getProductMovements,
  listProducts,
  updateProduct,
} = require("../controllers/product.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireFeature } = require("../middlewares/feature-guard.middleware");
const { validateObjectIdParam } = require("../middlewares/object-id.middleware");
const { permit } = require("../middlewares/role.middleware");
const { requireActiveSubscription } = require("../middlewares/subscription.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  productCreateValidator,
  productUpdateValidator,
  stockMovementValidator,
} = require("../validators/resource.validation");

const router = express.Router();

router.use(authMiddleware, tenantMiddleware, requireActiveSubscription());

router.get("/", listProducts);
router.get("/:productId", validateObjectIdParam("productId"), getProductById);
router.get(
  "/:productId/movements",
  requireFeature("inventory"),
  validateObjectIdParam("productId"),
  getProductMovements
);
router.post("/", permit("owner", "admin", "staff"), validate(productCreateValidator), createProduct);
router.post(
  "/:productId/movements",
  requireFeature("inventory"),
  validateObjectIdParam("productId"),
  permit("owner", "admin", "staff"),
  validate(stockMovementValidator),
  createProductMovement
);
router.put(
  "/:productId",
  validateObjectIdParam("productId"),
  permit("owner", "admin", "staff"),
  validate(productUpdateValidator),
  updateProduct
);
router.delete("/:productId", validateObjectIdParam("productId"), permit("owner", "admin"), deleteProduct);

module.exports = router;
