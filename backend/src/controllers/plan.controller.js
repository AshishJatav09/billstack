const asyncHandler = require("../utils/asyncHandler");
const { PLAN_DEFINITIONS } = require("../constants/plans");
const { getPlanByCode } = require("../utils/businessPlan");
const { ensureBusinessSubscription, getCommunicationUsage, getPlanEntitlements } = require("../utils/subscription");
const { listCommercialPlans, recommendPlanForProfile } = require("../services/commercial-plan.service");

const listPlans = asyncHandler(async (_req, res) => {
  const plans = await listCommercialPlans({ publicOnly: true });
  res.status(200).json({
    message: "Plans fetched successfully",
    data: plans.map((plan) => {
      const entitlements = plan.entitlements?.toObject?.() || plan.entitlements || {};
      return {
        code: plan.code,
        name: plan.name,
        shortDescription: plan.shortDescription,
        longDescription: plan.longDescription,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        currency: plan.currency,
        trialEligible: plan.trialEligible,
        trialDays: plan.trialDays,
        recommended: plan.recommended,
        badgeText: plan.badgeText,
        invoiceMonthlyLimit: plan.limits?.monthlyInvoices,
        staffUserLimit: plan.limits?.users,
        whatsappMonthlyQuota: plan.limits?.whatsappQuota,
        inventoryAccess: entitlements.inventory,
        purchasesAccess: entitlements.purchases,
        expensesAccess: entitlements.expenses,
        quotationsAccess: entitlements.quotations,
        creditNotesAccess: entitlements.creditNotes,
        salesReturnsAccess: entitlements.salesReturns,
        reportsAccess: entitlements.reports,
        pdfTemplatesAccess: entitlements.pdfTemplates,
        sharingAccess: entitlements.sharing,
        communicationsAccess: entitlements.communications,
        advancedGstAccess: entitlements.advancedGst,
        eInvoiceAccess: entitlements.eInvoice,
        apiAccess: entitlements.api,
        hrAccess: entitlements.hr,
      };
    }),
  });
});

const getCurrentPlan = asyncHandler(async (req, res) => {
  const subscription = await ensureBusinessSubscription({ businessId: req.business._id, planCode: req.business.planCode });
  const plan = getPlanByCode(subscription.planCode);

  res.status(200).json({
    message: "Current plan fetched successfully",
    data: {
      planCode: subscription.planCode,
      plan,
      entitlements: getPlanEntitlements(subscription),
      invoiceUsage: req.business.invoiceUsage,
      subscription,
      usage: await getCommunicationUsage({ businessId: req.business._id }),
      recommendation: recommendPlanForProfile(req.business.businessProfile || {}),
    },
  });
});

module.exports = {
  getCurrentPlan,
  listPlans,
};
