const express = require("express");
const auth = require("../middlewares/auth.middleware");
const tenant = require("../middlewares/tenant.middleware");
const { permit } = require("../middlewares/role.middleware");
const { requireActiveSubscription } = require("../middlewares/subscription.middleware");
const { requireModule } = require("../middlewares/module-guard.middleware");
const { validateObjectIdParam } = require("../middlewares/object-id.middleware");
const controller = require("../controllers/communication.controller");

const router = express.Router();
router.post("/webhooks/whatsapp/status", controller.whatsappProviderWebhook);

router.use(auth, tenant, requireActiveSubscription(), requireModule("communications"));

router.get("/summary", controller.summary);
router.get("/settings", controller.settings);
router.get("/templates", controller.templates);
router.post("/templates", permit("owner", "admin", "accountant"), controller.upsertTemplate);
router.get("/rules", controller.rules);
router.post("/rules", permit("owner", "admin", "accountant"), controller.createRule);
router.get("/scheduled", controller.scheduled);
router.get("/deliveries", controller.deliveries);
router.post("/process-due", permit("owner", "admin"), controller.processDue);
router.post("/webhooks/whatsapp/status/internal", controller.webhookStatus);
router.post("/invoices/:invoiceId/send", validateObjectIdParam("invoiceId"), permit("owner", "admin", "staff", "accountant"), controller.sendInvoice);
router.post("/invoices/:invoiceId/reminders", validateObjectIdParam("invoiceId"), permit("owner", "admin", "staff", "accountant"), controller.scheduleInvoiceReminder);

module.exports = router;
