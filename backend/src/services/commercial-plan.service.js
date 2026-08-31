const CommercialPlan = require("../models/CommercialPlan");
const Business = require("../models/Business");
const BusinessSubscription = require("../models/BusinessSubscription");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const Invoice = require("../models/Invoice");
const AppError = require("../utils/appError");
const { PLAN_CODES, PLAN_DEFINITIONS } = require("../constants/plans");
const { writeAuditLog } = require("./audit.service");

const planOrder = ["free", "starter", "growth", "pro", "enterprise"];
const compatibilityPlanMap = { basic: "starter" };
const isSelfHosted = () => String(process.env.BILLSTACK_DEPLOYMENT_MODE || "SAAS").toUpperCase() === "SELF_HOSTED";

const toCommercialPlan = (plan, index) => ({
  code: plan.compatibilityAliasFor ? plan.compatibilityAliasFor : plan.code,
  name: plan.compatibilityAliasFor ? "Starter" : plan.name,
  shortDescription: plan.shortDescription || "",
  longDescription: plan.shortDescription || "",
  monthlyPrice: plan.monthlyPrice || 0,
  yearlyPrice: plan.yearlyPrice || 0,
  currency: "INR",
  trialEligible: Boolean(plan.trialEligible),
  trialDays: Number(plan.trialDays || 0),
  active: true,
  publicVisible: true,
  displayOrder: index + 1,
  recommended: plan.code === PLAN_CODES.GROWTH,
  badgeText: plan.code === PLAN_CODES.GROWTH ? "Recommended" : plan.code === PLAN_CODES.PRO ? "14-day trial" : "",
  limits: {
    monthlyInvoices: plan.invoiceMonthlyLimit,
    users: plan.staffUserLimit,
    businesses: plan.businessLimit || 1,
    locations: plan.locationLimit || 1,
    customers: plan.customerLimit || 0,
    products: plan.productLimit || 0,
    storageMB: plan.storageMbLimit || 0,
    whatsappQuota: plan.whatsappMonthlyQuota || 0,
    apiQuota: plan.apiMonthlyQuota || 0,
  },
  entitlements: {
    inventory: Boolean(plan.inventoryAccess),
    purchases: Boolean(plan.purchasesAccess),
    expenses: Boolean(plan.expensesAccess),
    quotations: Boolean(plan.quotationsAccess),
    creditNotes: Boolean(plan.creditNotesAccess),
    salesReturns: Boolean(plan.salesReturnsAccess),
    reports: Boolean(plan.reportsAccess),
    pdfTemplates: Boolean(plan.pdfTemplatesAccess),
    sharing: Boolean(plan.sharingAccess),
    communications: Boolean(plan.communicationsAccess),
    advancedGst: Boolean(plan.advancedGstAccess),
    eInvoice: Boolean(plan.eInvoiceAccess),
    api: Boolean(plan.apiMonthlyQuota),
    hr: plan.staffUserLimit > 1,
    industryModules: Boolean(plan.industryModulesAccess),
    orderManagement: Boolean(plan.orderManagementAccess),
    projectsTasks: Boolean(plan.projectsTasksAccess),
    recurringBilling: Boolean(plan.recurringBillingAccess),
    appointmentsScheduling: Boolean(plan.appointmentsSchedulingAccess),
  },
});

const validatePlanPayload = (payload) => {
  ["monthlyPrice", "yearlyPrice", "trialDays"].forEach((field) => {
    if (payload[field] !== undefined && (!Number.isFinite(Number(payload[field])) || Number(payload[field]) < 0)) {
      throw new AppError(`${field} cannot be negative`, 400);
    }
  });
  if (payload.limits) {
    Object.entries(payload.limits).forEach(([key, value]) => {
      if (!Number.isFinite(Number(value)) || Number(value) < 0) throw new AppError(`Invalid plan limit: ${key}`, 400);
    });
  }
  if (payload.code === "free" && Number(payload.monthlyPrice || 0) > 0) {
    throw new AppError("Free plan cannot require provider payment", 400);
  }
};

const pickControlledPlanFields = (payload = {}) => {
  const allowed = [
    "name",
    "shortDescription",
    "longDescription",
    "monthlyPrice",
    "yearlyPrice",
    "currency",
    "trialEligible",
    "trialDays",
    "active",
    "publicVisible",
    "displayOrder",
    "recommended",
    "badgeText",
    "limits",
    "entitlements",
  ];
  return allowed.reduce((picked, key) => {
    if (payload[key] !== undefined) picked[key] = payload[key];
    return picked;
  }, {});
};

const syncCommercialPlans = async () => {
  const plans = planOrder.map((code, index) => {
    const source = PLAN_DEFINITIONS[code] || PLAN_DEFINITIONS.basic;
    return toCommercialPlan({ ...source, code }, index);
  });
  const rows = [];
  for (const plan of plans) {
    const row = await CommercialPlan.findOneAndUpdate(
      { code: plan.code },
      { $setOnInsert: plan },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    rows.push(row);
  }
  return rows;
};

const listCommercialPlans = async ({ publicOnly = false } = {}) => {
  await syncCommercialPlans();
  const filter = publicOnly ? { active: true, publicVisible: true } : {};
  return CommercialPlan.find(filter).sort({ displayOrder: 1, monthlyPrice: 1 });
};

const updateCommercialPlan = async ({ code, payload, req }) => {
  const controlledPayload = pickControlledPlanFields(payload);
  validatePlanPayload({ ...controlledPayload, code });
  const plan = await CommercialPlan.findOneAndUpdate(
    { code: String(code).toLowerCase() },
    { $set: controlledPayload },
    { new: true, runValidators: true }
  );
  if (!plan) throw new AppError("Commercial plan not found", 404);
  if (req) await writeAuditLog({ req, action: "COMMERCIAL_PLAN_UPDATED", entityType: "COMMERCIAL_PLAN", entityId: plan._id, metadata: { code: plan.code } });
  return plan;
};

const getCommercialPlanByCode = async (code) => {
  const normalized = compatibilityPlanMap[String(code || "").toLowerCase()] || String(code || PLAN_CODES.FREE).toLowerCase();
  await syncCommercialPlans();
  return CommercialPlan.findOne({ code: normalized, active: true });
};

const normalizeNeedKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const recommendPlanForProfile = (profile = {}) => {
  const needs = new Set([...(profile.selectedNeeds || []), ...(profile.recommendedModules || [])].map(normalizeNeedKey));
  const users = Number(profile.numberOfUsers || 1);
  const reasons = [];
  let recommendedPlanCode = "starter";
  if (users <= 1 && !needs.has("inventory") && !needs.has("purchases") && !needs.has("communications")) {
    recommendedPlanCode = "free";
    reasons.push("Free covers basic billing for one user.");
  }
  if (needs.has("inventory") || needs.has("purchases") || users > 3) {
    recommendedPlanCode = "growth";
    reasons.push("Growth is recommended for inventory, purchases, or a growing team.");
  }
  if (needs.has("advancedgst") || needs.has("einvoice") || needs.has("api") || users > 10) {
    recommendedPlanCode = "pro";
    reasons.push("Pro is recommended for advanced GST/e-invoice/API needs.");
  }
  if (users > 50 || needs.has("industry") || needs.has("industrymodules")) {
    recommendedPlanCode = "enterprise";
    reasons.push("Enterprise is recommended for custom limits and negotiated modules.");
  }
  return { recommendedPlanCode, reasons: reasons.length ? reasons : ["Recommendation is based on your business profile and selected needs."] };
};

const startTrialForNewBusiness = async ({ businessId, trialPlanCode = PLAN_CODES.PRO, trialSource = "signup", session } = {}) => {
  if (isSelfHosted()) return null;
  const existing = await BusinessSubscription.findOne({ businessId }).session(session);
  if (existing?.trialConsumed) return existing;
  const plan = await getCommercialPlanByCode(trialPlanCode);
  const trialDays = Number(plan?.trialDays || PLAN_DEFINITIONS.pro.trialDays || 14);
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
  const subscription = existing || new BusinessSubscription({ businessId });
  subscription.planCode = trialPlanCode;
  subscription.status = "trial";
  subscription.lifecycleStatus = "TRIAL";
  subscription.trialStartedAt = now;
  subscription.trialEndsAt = trialEndsAt;
  subscription.trialSource = trialSource;
  subscription.trialPlanCode = trialPlanCode;
  subscription.trialConsumed = true;
  subscription.sourceOfTruthVersion = "phase-free-trial-commercial";
  await subscription.save({ session });
  await Business.findByIdAndUpdate(businessId, { planCode: trialPlanCode, subscriptionExpiresAt: trialEndsAt }, { session });
  return subscription;
};

const expireTrialsToFree = async ({ now = new Date(), businessId = null, session } = {}) => {
  const filter = { status: "trial", trialEndsAt: { $lte: now } };
  if (businessId) filter.businessId = businessId;
  const trials = await BusinessSubscription.find(filter).session(session);
  for (const subscription of trials) {
    subscription.planCode = PLAN_CODES.FREE;
    subscription.status = "free";
    subscription.lifecycleStatus = "FREE";
    subscription.currentEnd = null;
    subscription.graceEndsAt = null;
    await subscription.save({ session });
    await Business.findByIdAndUpdate(subscription.businessId, { planCode: PLAN_CODES.FREE, subscriptionExpiresAt: null }, { session });
  }
  return { processed: trials.length };
};

const createSampleData = async ({ businessId, userId }) => {
  const existing = await Customer.countDocuments({ businessId, isSampleData: true });
  if (existing > 0) return { created: false, message: "Sample data already exists" };
  const customer = await Customer.create({ businessId, name: "Sample Customer", email: "sample.customer@example.com", billingAddress: "Sample billing address", isSampleData: true, sampleDataKey: "default" });
  const product = await Product.create({ businessId, name: "Sample Service", sku: `SAMPLE-${businessId.toString().slice(-6)}`, sellingPrice: 2500, taxRate: 18, trackInventory: false, isSampleData: true, sampleDataKey: "default" });
  const invoice = await Invoice.create({
    businessId,
    customerId: customer._id,
    invoiceNumber: `SAMPLE-${Date.now()}`,
    invoiceDate: new Date(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    lineItems: [{ productId: product._id, productName: product.name, quantity: 1, rate: 2500, taxRate: 18, tax: 450, discount: 0, taxableAmount: 2500, itemTotal: 2950 }],
    subtotal: 2500,
    totalTax: 450,
    totalDiscount: 0,
    grandTotal: 2950,
    amountPaid: 0,
    balanceDue: 2950,
    paymentStatus: "unpaid",
    createdBy: userId,
    isSampleData: true,
    sampleDataKey: "default",
  });
  return { created: true, customer, product, invoice };
};

const removeSampleData = async ({ businessId }) => {
  const [invoices, products, customers] = await Promise.all([
    Invoice.deleteMany({ businessId, isSampleData: true }),
    Product.deleteMany({ businessId, isSampleData: true }),
    Customer.deleteMany({ businessId, isSampleData: true }),
  ]);
  return { invoices: invoices.deletedCount, products: products.deletedCount, customers: customers.deletedCount };
};

module.exports = {
  compatibilityPlanMap,
  createSampleData,
  expireTrialsToFree,
  getCommercialPlanByCode,
  listCommercialPlans,
  recommendPlanForProfile,
  removeSampleData,
  startTrialForNewBusiness,
  syncCommercialPlans,
  updateCommercialPlan,
  validatePlanPayload,
  pickControlledPlanFields,
};
