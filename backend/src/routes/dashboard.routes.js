const express = require("express");

const { getDashboardSummary } = require("../controllers/dashboard.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireActiveSubscription } = require("../middlewares/subscription.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");

const router = express.Router();

router.use(authMiddleware, tenantMiddleware, requireActiveSubscription());

router.get("/summary", getDashboardSummary);

module.exports = router;
