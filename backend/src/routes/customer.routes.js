const express = require("express");

const {
  createCustomer,
  deleteCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
} = require("../controllers/customer.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { validateObjectIdParam } = require("../middlewares/object-id.middleware");
const { permit } = require("../middlewares/role.middleware");
const { requireActiveSubscription } = require("../middlewares/subscription.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  customerCreateValidator,
  customerUpdateValidator,
} = require("../validators/resource.validation");

const router = express.Router();

router.use(authMiddleware, tenantMiddleware, requireActiveSubscription());

router.get("/", listCustomers);
router.get("/:customerId", validateObjectIdParam("customerId"), getCustomerById);
router.post("/", permit("owner", "admin", "staff", "accountant"), validate(customerCreateValidator), createCustomer);
router.put(
  "/:customerId",
  validateObjectIdParam("customerId"),
  permit("owner", "admin", "staff", "accountant"),
  validate(customerUpdateValidator),
  updateCustomer
);
router.delete("/:customerId", validateObjectIdParam("customerId"), permit("owner", "admin"), deleteCustomer);

module.exports = router;
