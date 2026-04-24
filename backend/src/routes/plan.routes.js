const express = require("express");

const { getCurrentPlan, listPlans } = require("../controllers/plan.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");
const Business = require("../models/Business");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");

const router = express.Router();

router.get("/", listPlans);
router.get(
  "/current",
  authMiddleware,
  tenantMiddleware,
  asyncHandler(async (req, _res, next) => {
    const business = await Business.findById(req.tenant.businessId);

    if (!business) {
      throw new AppError("Business not found", 404);
    }

    req.business = business;
    next();
  }),
  getCurrentPlan
);

module.exports = router;

