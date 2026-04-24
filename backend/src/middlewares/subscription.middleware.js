const Business = require("../models/Business");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const {
  ensureBusinessSubscription,
  isSubscriptionAccessible,
  isSubscriptionExpired,
} = require("../utils/subscription");

const requireActiveSubscription = () =>
  asyncHandler(async (req, _res, next) => {
    const business = await Business.findById(req.tenant.businessId);

    if (!business) {
      throw new AppError("Business not found", 404);
    }

    const subscription = await ensureBusinessSubscription({
      businessId: business._id,
      planCode: business.planCode,
    });

    req.business = business;
    req.subscription = subscription;

    if (!isSubscriptionAccessible(subscription)) {
      const message = isSubscriptionExpired(subscription)
        ? "Your subscription has expired. Renew or downgrade to continue."
        : "An active subscription is required to access this feature.";
      throw new AppError(message, 402);
    }

    next();
  });

module.exports = {
  requireActiveSubscription,
};

