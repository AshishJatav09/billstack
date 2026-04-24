const express = require("express");

const {
  cancelInvoice,
  createInvoice,
  downloadInvoicePdf,
  emailInvoicePdf,
  getInvoiceById,
  listInvoices,
  updateInvoice,
} = require("../controllers/invoice.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireInvoiceCapacity } = require("../middlewares/feature-guard.middleware");
const { validateObjectIdParam } = require("../middlewares/object-id.middleware");
const { permit } = require("../middlewares/role.middleware");
const { requireActiveSubscription } = require("../middlewares/subscription.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  invoiceCreateValidator,
  invoiceUpdateValidator,
} = require("../validators/resource.validation");

const router = express.Router();

router.use(authMiddleware, tenantMiddleware, requireActiveSubscription());

router.get("/", listInvoices);
router.get("/:invoiceId/pdf", validateObjectIdParam("invoiceId"), downloadInvoicePdf);
router.get("/:invoiceId", validateObjectIdParam("invoiceId"), getInvoiceById);
router.post("/", permit("owner", "admin", "staff", "accountant"), requireInvoiceCapacity(), validate(invoiceCreateValidator), createInvoice);
router.put(
  "/:invoiceId",
  validateObjectIdParam("invoiceId"),
  permit("owner", "admin", "staff", "accountant"),
  validate(invoiceUpdateValidator),
  updateInvoice
);
router.post("/:invoiceId/cancel", validateObjectIdParam("invoiceId"), permit("owner", "admin", "accountant"), cancelInvoice);
router.post("/:invoiceId/share/email", validateObjectIdParam("invoiceId"), permit("owner", "admin", "staff", "accountant"), emailInvoicePdf);

module.exports = router;
