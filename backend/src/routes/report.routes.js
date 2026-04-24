const express = require("express");

const { getReportsSummary } = require("../controllers/report.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireFeature } = require("../middlewares/feature-guard.middleware");
const { requireActiveSubscription } = require("../middlewares/subscription.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");

const router = express.Router();

router.use(authMiddleware, tenantMiddleware, requireActiveSubscription(), requireFeature("reports"));

router.get("/summary", getReportsSummary);

module.exports = router;
