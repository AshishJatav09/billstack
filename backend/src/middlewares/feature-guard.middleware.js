const { PLAN_FEATURE_MAP } = require("../constants/plans");
const Business = require("../models/Business");
const Invoice = require("../models/Invoice");
const AppError = require("../utils/appError");
const { getPlanByCode } = require("../utils/businessPlan");
const asyncHandler = require("../utils/asyncHandler");
const { ensureBusinessSubscription, isSubscriptionAccessible } = require("../utils/subscription");

const requireFeature = (featureKey) =>
  asyncHandler(async (req, _res, next) => {
    const business = await Business.findById(req.tenant.businessId);

    if (!business) {
      throw new AppError("Business not found", 404);
    }

    const subscription = await ensureBusinessSubscription({
      businessId: business._id,
      planCode: business.planCode,
    });

    if (!isSubscriptionAccessible(subscription)) {
      throw new AppError("Your subscription is inactive or expired", 402);
    }

    const plan = getPlanByCode(business.planCode);
    const mappedFeature = PLAN_FEATURE_MAP[featureKey];

    if (!mappedFeature || !plan[mappedFeature]) {
      throw new AppError(`Your ${plan.name} plan does not include ${featureKey} access`, 403);
    }

    req.plan = plan;
    next();
  });

const requireInvoiceCapacity = () =>
  asyncHandler(async (req, _res, next) => {
    const business = await Business.findById(req.tenant.businessId);

    if (!business) {
      throw new AppError("Business not found", 404);
    }

    const subscription = await ensureBusinessSubscription({
      businessId: business._id,
      planCode: business.planCode,
    });

    if (!isSubscriptionAccessible(subscription)) {
      throw new AppError("Your subscription is inactive or expired", 402);
    }

    const plan = getPlanByCode(business.planCode);
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const invoiceCount = await Invoice.countDocuments({
      businessId: business._id,
      status: { $ne: "cancelled" },
      invoiceDate: {
        $gte: new Date(`${currentMonthKey}-01T00:00:00.000Z`),
      },
    });

    business.invoiceUsage.monthKey = currentMonthKey;
    business.invoiceUsage.count = invoiceCount;
    await business.save();

    if (invoiceCount >= plan.invoiceMonthlyLimit) {
      throw new AppError(
        `Invoice limit reached for the ${plan.name} plan. Monthly limit: ${plan.invoiceMonthlyLimit}`,
        403
      );
    }

    req.plan = plan;
    req.invoiceUsage = business.invoiceUsage;
    next();
  });

const requireStaffCapacity = () =>
  asyncHandler(async (req, _res, next) => {
    const business = await Business.findById(req.tenant.businessId);

    if (!business) {
      throw new AppError("Business not found", 404);
    }

    const subscription = await ensureBusinessSubscription({
      businessId: business._id,
      planCode: business.planCode,
    });

    if (!isSubscriptionAccessible(subscription)) {
      throw new AppError("Your subscription is inactive or expired", 402);
    }

    const plan = getPlanByCode(business.planCode);
    const projectedStaffCount = Number(req.body.projectedStaffCount || 0);

    if (projectedStaffCount > plan.staffUserLimit) {
      throw new AppError(
        `Staff user limit reached for the ${plan.name} plan. Allowed users: ${plan.staffUserLimit}`,
        403
      );
    }

    req.plan = plan;
    next();
  });

module.exports = {
  requireFeature,
  requireInvoiceCapacity,
  requireStaffCapacity,
};
