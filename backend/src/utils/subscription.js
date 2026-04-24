const BusinessSubscription = require("../models/BusinessSubscription");

const getDefaultSubscriptionState = (businessId, planCode = "free") => ({
  businessId,
  planCode,
  status: planCode === "free" ? "active" : "inactive",
  quantity: 1,
  totalCount: 12,
});

const isSubscriptionExpired = (subscription) => {
  if (!subscription) {
    return false;
  }

  if (["expired", "cancelled", "completed"].includes(subscription.status)) {
    return true;
  }

  if (subscription.currentEnd && new Date(subscription.currentEnd).getTime() < Date.now()) {
    return true;
  }

  return false;
};

const isSubscriptionAccessible = (subscription) => {
  if (!subscription) {
    return true;
  }

  if (subscription.planCode === "free") {
    return true;
  }

  return ["active", "authenticated"].includes(subscription.status) && !isSubscriptionExpired(subscription);
};

const ensureBusinessSubscription = async ({ businessId, planCode }) => {
  let subscription = await BusinessSubscription.findOne({ businessId });

  if (!subscription) {
    subscription = await BusinessSubscription.create(
      getDefaultSubscriptionState(businessId, planCode)
    );
  }

  return subscription;
};

module.exports = {
  ensureBusinessSubscription,
  getDefaultSubscriptionState,
  isSubscriptionAccessible,
  isSubscriptionExpired,
};

