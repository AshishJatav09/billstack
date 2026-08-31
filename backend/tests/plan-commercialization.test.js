const test = require("node:test");
const assert = require("node:assert/strict");

const AppError = require("../src/utils/appError");
const BusinessSubscription = require("../src/models/BusinessSubscription");
const CommercialPlan = require("../src/models/CommercialPlan");
const Customer = require("../src/models/Customer");
const Invoice = require("../src/models/Invoice");
const Product = require("../src/models/Product");
const { PLAN_CODES, PLAN_DEFINITIONS, PLAN_FEATURE_MAP } = require("../src/constants/plans");
const { getPlanByCode } = require("../src/utils/businessPlan");
const {
  getDefaultSubscriptionState,
  getPlanEntitlements,
  normalizePlanCode,
} = require("../src/services/subscription.service");
const { recommendPlanForProfile } = require("../src/services/commercial-plan.service");

test("commercial SaaS catalogue exposes Free, Starter, Growth, Pro and Enterprise plan definitions", () => {
  for (const code of ["free", "starter", "growth", "pro", "enterprise"]) {
    const plan = PLAN_DEFINITIONS[code];
    assert.equal(plan.code, code);
    assert.equal(typeof plan.monthlyPrice, "number");
    assert.equal(typeof plan.yearlyPrice, "number");
    assert.equal(typeof plan.invoiceMonthlyLimit, "number");
    assert.equal(typeof plan.staffUserLimit, "number");
    assert.equal(typeof plan.whatsappMonthlyQuota, "number");
  }

  assert.equal(PLAN_DEFINITIONS.free.monthlyPrice, 0);
  assert.equal(PLAN_DEFINITIONS.free.invoiceMonthlyLimit, 20);
  assert.equal(PLAN_DEFINITIONS.pro.trialEligible, true);
  assert.equal(PLAN_DEFINITIONS.pro.trialDays, 14);
});

test("legacy Basic plan maps to Starter for compatibility without removing the old code", () => {
  assert.equal(normalizePlanCode("basic"), PLAN_CODES.STARTER);
  assert.equal(getPlanByCode("basic").code, PLAN_CODES.STARTER);
  assert.equal(PLAN_DEFINITIONS.basic.compatibilityAliasFor, PLAN_CODES.STARTER);
});

test("CommercialPlan validates backend-owned prices, limits, trial settings and visibility", async () => {
  const validPlan = new CommercialPlan({
    code: "growth",
    name: "Growth",
    monthlyPrice: 1799,
    yearlyPrice: 17990,
    trialEligible: false,
    trialDays: 0,
    limits: { monthlyInvoices: 1000, users: 10, whatsappQuota: 500 },
    entitlements: { inventory: true, reports: true, communications: true },
  });

  await assert.doesNotReject(() => validPlan.validate());

  validPlan.monthlyPrice = -1;
  await assert.rejects(() => validPlan.validate(), /less than minimum/);
});

test("BusinessSubscription schema supports trial provenance and prevents repeat-trial state loss", () => {
  const subscription = new BusinessSubscription({
    businessId: "64f000000000000000000001",
    planCode: "pro",
    status: "trial",
    lifecycleStatus: "TRIAL",
    trialStartedAt: new Date(),
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    trialSource: "email_signup",
    trialPlanCode: "pro",
    trialConsumed: true,
  });

  assert.equal(subscription.status, "trial");
  assert.equal(subscription.trialConsumed, true);
  assert.ok(BusinessSubscription.schema.path("trialSource"));
  assert.ok(BusinessSubscription.schema.path("trialConsumed"));
});

test("default free subscription remains accessible and add-ons extend plan entitlements centrally", () => {
  const defaultState = getDefaultSubscriptionState("64f000000000000000000001", "free");
  assert.equal(defaultState.planCode, "free");
  assert.equal(defaultState.status, "free");

  const growthWithAddons = getPlanEntitlements({
    planCode: "growth",
    addonEntitlements: { extraUsers: 5, whatsappPackage: 250, industryModules: ["retail"] },
  });
  assert.equal(growthWithAddons.staffUserLimit, PLAN_DEFINITIONS.growth.staffUserLimit + 5);
  assert.equal(growthWithAddons.whatsappMonthlyQuota, PLAN_DEFINITIONS.growth.whatsappMonthlyQuota + 250);
  assert.deepEqual(growthWithAddons.industryModules, ["retail"]);
});

test("plan recommendation is deterministic from business profile and selected module needs", () => {
  assert.equal(recommendPlanForProfile({ selectedNeeds: [] }).recommendedPlanCode, "free");
  assert.equal(recommendPlanForProfile({ selectedNeeds: ["inventory"] }).recommendedPlanCode, "growth");
  assert.equal(recommendPlanForProfile({ selectedNeeds: ["e-invoice"] }).recommendedPlanCode, "pro");
  assert.equal(recommendPlanForProfile({ selectedNeeds: ["industry"] }).recommendedPlanCode, "enterprise");
});

test("plan feature map separates commercial entitlement from role/module activation", () => {
  for (const feature of ["inventory", "purchases", "quotations", "creditNotes", "salesReturns", "communications", "eInvoice"]) {
    assert.equal(typeof PLAN_FEATURE_MAP[feature], "string");
  }
});

test("sample data foundation is isolated by explicit model fields and indexes", () => {
  for (const Model of [Customer, Product, Invoice]) {
    assert.ok(Model.schema.path("isSampleData"));
    assert.ok(Model.schema.path("sampleDataKey"));
    const indexes = Model.schema.indexes().map(([fields]) => fields);
    assert.ok(indexes.some((fields) => fields.businessId === 1 && fields.isSampleData === 1));
  }
});

test("structured limit errors can carry frontend-safe upgrade metadata", () => {
  const error = new AppError("Monthly invoice limit reached", 403, {
    code: "LIMIT_REACHED",
    feature: "invoices",
    current: 20,
    limit: 20,
    recommendedAction: "UPGRADE_PLAN",
  });

  assert.equal(error.code, "LIMIT_REACHED");
  assert.equal(error.feature, "invoices");
  assert.equal(error.limit, 20);
  assert.equal(error.recommendedAction, "UPGRADE_PLAN");
});
