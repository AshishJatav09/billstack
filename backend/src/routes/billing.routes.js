const express = require("express");

const {
  changeSubscriptionPlan,
  createSubscription,
  getCurrentSubscription,
  handleSubscriptionCallback,
  handleRazorpayWebhook,
  verifySubscriptionPayment,
} = require("../controllers/billing.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { permit } = require("../middlewares/role.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");

const router = express.Router();

router.post("/webhook", express.raw({ type: "application/json" }), handleRazorpayWebhook);
router.post("/subscription/callback", handleSubscriptionCallback);

router.use(authMiddleware, tenantMiddleware);

router.get("/subscription", getCurrentSubscription);
router.post("/subscription", permit("owner"), createSubscription);
router.post("/subscription/verify", permit("owner"), verifySubscriptionPayment);
router.post("/subscription/change-plan", permit("owner"), changeSubscriptionPlan);

module.exports = router;
