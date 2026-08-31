const Business = require("../models/Business");
const BusinessSubscription = require("../models/BusinessSubscription");
const MessageDelivery = require("../models/MessageDelivery");
const AppError = require("../utils/appError");
const { PLAN_DEFINITIONS, PLAN_CODES, PLAN_FEATURE_MAP } = require("../constants/plans");

const ACCESSIBLE_STATUSES = new Set(["free", "trial", "active", "grace_period"]);
const EXPIRED_STATUSES = new Set(["cancelled", "completed", "expired"]);
const PAID_PROBLEM_STATUSES = new Set(["past_due", "halted"]);

const normalizePlanCode = (planCode = PLAN_CODES.FREE) => {
  const compatibilityMap = { basic: PLAN_CODES.STARTER };
  const code = compatibilityMap[String(planCode || "").trim().toLowerCase()] || String(planCode || PLAN_CODES.FREE).trim().toLowerCase();
  if (!PLAN_DEFINITIONS[code]) throw new AppError("Invalid plan code", 400);
  return code;
};

const normalizeStatus = (status, planCode = PLAN_CODES.FREE) => {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return planCode === PLAN_CODES.FREE ? "free" : "inactive";
  if (value === "active" && planCode === PLAN_CODES.FREE) return "free";
  if (["free", "trial", "active", "authenticated", "past_due", "grace_period", "cancelled", "expired", "inactive", "created", "pending", "halted", "completed"].includes(value)) return value;
  return value;
};

const getDefaultSubscriptionState = (businessId, planCode = PLAN_CODES.FREE) => ({
  businessId,
  planCode: normalizePlanCode(planCode),
  status: normalizePlanCode(planCode) === PLAN_CODES.FREE ? "free" : "inactive",
  quantity: 1,
  totalCount: 12,
  sourceOfTruthVersion: "phase15",
});

const syncBusinessCache = async ({ business, subscription, session } = {}) => {
  if (!business || !subscription) return null;
  business.planCode = subscription.planCode || PLAN_CODES.FREE;
  business.subscriptionExpiresAt = subscription.currentEnd || subscription.trialEndsAt || subscription.graceEndsAt || null;
  await business.save({ session });
  return business;
};

const ensureBusinessSubscription = async ({ businessId, planCode = PLAN_CODES.FREE, session } = {}) => {
  let subscription = await BusinessSubscription.findOne({ businessId }).session(session);
  if (!subscription) {
    subscription = await BusinessSubscription.create([getDefaultSubscriptionState(businessId, planCode)], { session }).then((rows) => rows[0]);
    const business = await Business.findById(businessId).session(session);
    await syncBusinessCache({ business, subscription, session });
    return subscription;
  }
  const normalized = normalizeStatus(subscription.status, subscription.planCode);
  if (normalized === "trial" && subscription.trialEndsAt && new Date(subscription.trialEndsAt).getTime() < Date.now()) {
    subscription.planCode = PLAN_CODES.FREE;
    subscription.status = "free";
    subscription.lifecycleStatus = "FREE";
    subscription.currentEnd = null;
    subscription.graceEndsAt = null;
    await subscription.save({ session });
    const business = await Business.findById(businessId).session(session);
    await syncBusinessCache({ business, subscription, session });
    return subscription;
  }
  if (subscription.status !== normalized) {
    subscription.status = normalized;
    await subscription.save({ session });
  }
  return subscription;
};

const isSubscriptionExpired = (subscription) => {
  if (!subscription) return false;
  const status = normalizeStatus(subscription.status, subscription.planCode);
  if (EXPIRED_STATUSES.has(status)) return true;
  if (status === "trial" && subscription.trialEndsAt && new Date(subscription.trialEndsAt).getTime() < Date.now()) return true;
  if (status === "grace_period" && subscription.graceEndsAt && new Date(subscription.graceEndsAt).getTime() < Date.now()) return true;
  if (subscription.currentEnd && new Date(subscription.currentEnd).getTime() < Date.now() && subscription.planCode !== PLAN_CODES.FREE) return true;
  return false;
};

const isSubscriptionAccessible = (subscription) => {
  if (!subscription) return true;
  const status = normalizeStatus(subscription.status, subscription.planCode);
  if (subscription.planCode === PLAN_CODES.FREE || status === "free") return true;
  return ACCESSIBLE_STATUSES.has(status) && !isSubscriptionExpired(subscription);
};

const getPlanEntitlements = (subscription) => {
  const planCode = normalizePlanCode(subscription?.planCode || PLAN_CODES.FREE);
  const plan = PLAN_DEFINITIONS[planCode];
  const addon = subscription?.addonEntitlements || {};
  const workflowModules = new Set([...(addon.workflowModules || []), ...(addon.industryModules || [])]);
  return {
    ...plan,
    planCode,
    staffUserLimit: plan.staffUserLimit + Number(addon.extraUsers || 0),
    whatsappMonthlyQuota: plan.whatsappMonthlyQuota === Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : plan.whatsappMonthlyQuota + Number(addon.whatsappPackage || 0),
    industryModules: addon.industryModules || [],
    orderManagementAccess: Boolean(plan.orderManagementAccess || workflowModules.has("order_management")),
    projectsTasksAccess: Boolean(plan.projectsTasksAccess || workflowModules.has("projects_tasks")),
    recurringBillingAccess: Boolean(plan.recurringBillingAccess || workflowModules.has("recurring_billing")),
    appointmentsSchedulingAccess: Boolean(plan.appointmentsSchedulingAccess || workflowModules.has("appointments_scheduling")),
    productionJobWorkAccess: Boolean(plan.productionJobWorkAccess || workflowModules.has("production_job_work")),
    batchExpiryAccess: Boolean(plan.batchExpiryAccess || workflowModules.has("batch_expiry")),
    dispatchFulfilmentAccess: Boolean(plan.dispatchFulfilmentAccess || workflowModules.has("dispatch_fulfilment")),
    documentsApprovalsAccess: Boolean(plan.documentsApprovalsAccess || workflowModules.has("documents_approvals")),
  };
};

const assertEntitlement = (subscription, feature) => {
  if (!isSubscriptionAccessible(subscription)) throw new AppError("Your subscription is inactive or expired", 402);
  const key = PLAN_FEATURE_MAP[feature] || feature;
  const entitlements = getPlanEntitlements(subscription);
  if (!entitlements[key]) throw new AppError(`Your current plan does not include ${feature}`, 403);
  return true;
};

const applyControlledPlanChange = async ({ businessId, planCode, status, source = "system", scheduleChangeAt = "", session } = {}) => {
  const targetPlan = normalizePlanCode(planCode);
  const subscription = await ensureBusinessSubscription({ businessId, planCode: targetPlan, session });
  subscription.planCode = targetPlan;
  subscription.status = normalizeStatus(status || (targetPlan === PLAN_CODES.FREE ? "free" : "active"), targetPlan);
  subscription.pendingPlanCode = "";
  subscription.scheduleChangeAt = scheduleChangeAt || "";
  subscription.sourceOfTruthVersion = "phase15";
  if (subscription.status === "cancelled") subscription.cancelledAt = new Date();
  if (subscription.status === "past_due") subscription.failedPaymentAt = new Date();
  await subscription.save({ session });
  const business = await Business.findById(businessId).session(session);
  await syncBusinessCache({ business, subscription, session });
  subscription._phase15Source = source;
  return { business, subscription };
};

const markLifecycleState = async ({ businessId, status, graceDays = 7, session } = {}) => {
  const subscription = await ensureBusinessSubscription({ businessId, session });
  const nextStatus = normalizeStatus(status, subscription.planCode);
  subscription.status = nextStatus;
  if (nextStatus === "grace_period") subscription.graceEndsAt = new Date(Date.now() + Number(graceDays) * 24 * 60 * 60 * 1000);
  if (nextStatus === "past_due") subscription.failedPaymentAt = new Date();
  if (nextStatus === "expired" || nextStatus === "cancelled") subscription.cancelledAt = nextStatus === "cancelled" ? new Date() : subscription.cancelledAt;
  await subscription.save({ session });
  const business = await Business.findById(businessId).session(session);
  await syncBusinessCache({ business, subscription, session });
  return { business, subscription };
};

const getCommunicationUsage = async ({ businessId, periodStart, periodEnd } = {}) => {
  const start = periodStart ? new Date(periodStart) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = periodEnd ? new Date(periodEnd) : new Date();
  const rows = await MessageDelivery.aggregate([
    { $match: { businessId, createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: "$channel", sent: { $sum: { $cond: [{ $in: ["$status", ["SENT", "DELIVERED", "READ"]] }, 1, 0] } }, delivered: { $sum: { $cond: [{ $in: ["$status", ["DELIVERED", "READ"]] }, 1, 0] } }, failed: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } } } },
  ]);
  const byChannel = rows.reduce((acc, row) => ({ ...acc, [row._id]: { sent: row.sent, delivered: row.delivered, failed: row.failed } }), {});
  const subscription = await ensureBusinessSubscription({ businessId });
  const entitlements = getPlanEntitlements(subscription);
  const whatsapp = byChannel.WHATSAPP || { sent: 0, delivered: 0, failed: 0 };
  return {
    periodStart: start,
    periodEnd: end,
    byChannel,
    whatsapp: {
      ...whatsapp,
      quota: entitlements.whatsappMonthlyQuota,
      overageReady: entitlements.whatsappMonthlyQuota !== Number.MAX_SAFE_INTEGER && whatsapp.sent > entitlements.whatsappMonthlyQuota,
    },
  };
};

module.exports = {
  ACCESSIBLE_STATUSES,
  applyControlledPlanChange,
  assertEntitlement,
  ensureBusinessSubscription,
  getCommunicationUsage,
  getDefaultSubscriptionState,
  getPlanEntitlements,
  isSubscriptionAccessible,
  isSubscriptionExpired,
  markLifecycleState,
  normalizePlanCode,
  normalizeStatus,
  syncBusinessCache,
};
