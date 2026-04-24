const asyncHandler = require("../utils/asyncHandler");
const { PLAN_DEFINITIONS } = require("../constants/plans");
const { getPlanByCode } = require("../utils/businessPlan");

const listPlans = asyncHandler(async (_req, res) => {
  res.status(200).json({
    message: "Plans fetched successfully",
    data: Object.values(PLAN_DEFINITIONS),
  });
});

const getCurrentPlan = asyncHandler(async (req, res) => {
  const plan = getPlanByCode(req.business.planCode);

  res.status(200).json({
    message: "Current plan fetched successfully",
    data: {
      planCode: req.business.planCode,
      plan,
      invoiceUsage: req.business.invoiceUsage,
    },
  });
});

module.exports = {
  getCurrentPlan,
  listPlans,
};

