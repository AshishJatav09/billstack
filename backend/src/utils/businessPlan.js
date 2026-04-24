const { PLAN_CODES, PLAN_DEFINITIONS } = require("../constants/plans");
const { isSubscriptionAccessible, isSubscriptionExpired } = require("./subscription");

const getPlanByCode = (code) => PLAN_DEFINITIONS[code] || PLAN_DEFINITIONS[PLAN_CODES.FREE];

const serializeBusinessWithPlan = (business, subscription = null) => {
  const plan = getPlanByCode(business.planCode);

  return {
    id: business._id,
    name: business.name,
    slug: business.slug,
    industry: business.industry,
    billingEmail: business.billingEmail,
    email: business.email,
    phone: business.phone,
    address: business.address,
    logoUrl: business.logoUrl,
    gstTaxId: business.gstTaxId,
    bankDetails: business.bankDetails,
    invoiceTerms: business.invoiceTerms,
    defaultTaxSettings: business.defaultTaxSettings,
    invoiceNumbering: business.invoiceNumbering,
    onboardingCompleted: business.onboardingCompleted,
    planCode: business.planCode,
    plan,
    isDisabled: business.isDisabled,
    invoiceUsage: business.invoiceUsage,
    inventorySettings: business.inventorySettings,
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
    subscription: subscription
      ? {
          id: subscription._id,
          planCode: subscription.planCode,
          razorpayPlanId: subscription.razorpayPlanId,
          razorpaySubscriptionId: subscription.razorpaySubscriptionId,
          status: subscription.status,
          quantity: subscription.quantity,
          totalCount: subscription.totalCount,
          paidCount: subscription.paidCount,
          currentStart: subscription.currentStart,
          currentEnd: subscription.currentEnd,
          expireBy: subscription.expireBy,
          shortUrl: subscription.shortUrl,
          pendingPlanCode: subscription.pendingPlanCode,
          scheduleChangeAt: subscription.scheduleChangeAt,
          lastPaymentId: subscription.lastPaymentId,
          verifiedAt: subscription.verifiedAt,
          cancelledAt: subscription.cancelledAt,
          isAccessible: isSubscriptionAccessible(subscription),
          isExpired: isSubscriptionExpired(subscription),
        }
      : null,
  };
};

module.exports = {
  getPlanByCode,
  serializeBusinessWithPlan,
};
