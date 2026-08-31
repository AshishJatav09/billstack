const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const { EXPENSE_CATEGORIES } = require("../src/constants/expenses");
const { moduleCatalog, presets } = require("../src/constants/modules");
const { PLAN_DEFINITIONS, PLAN_FEATURE_MAP } = require("../src/constants/plans");
const Business = require("../src/models/Business");
const CommercialPlan = require("../src/models/CommercialPlan");
const CustomerLedger = require("../src/models/CustomerLedger");
const Expense = require("../src/models/Expense");
const { buildStatementCsv, ledgerEventTypeForStatementType } = require("../src/services/customer-statement.service");
const { pickControlledPlanFields, validatePlanPayload, recommendPlanForProfile } = require("../src/services/commercial-plan.service");
const { capabilityCatalog, industryCatalog } = require("../src/constants/industry-presets");
const { resolveWorkspacePreset } = require("../src/services/module.service");
const { normalizeExpensePayload } = require("../src/services/expense.service");

test("expenses module is implemented, default-enabled, and included in business presets", () => {
  const expenseModule = moduleCatalog.find((item) => item.key === "expenses");

  assert.equal(expenseModule.status, "IMPLEMENTED");
  assert.equal(expenseModule.defaultEnabled, true);
  assert.equal(expenseModule.availableForSaas, true);
  assert.equal(expenseModule.availableForSelfHosted, true);
  assert.equal(presets.SERVICE.includes("expenses"), true);
  assert.equal(presets.TRADING.includes("expenses"), true);
  assert.equal(presets.PROJECT_BASED.includes("expenses"), true);
});

test("plan catalogue exposes expenses through centralized entitlement mapping", () => {
  assert.equal(PLAN_FEATURE_MAP.expenses, "expensesAccess");
  Object.values(PLAN_DEFINITIONS).forEach((plan) => assert.equal(plan.expensesAccess, true));
});

test("business schema contains separate expense numbering configuration", () => {
  const business = new Business({ name: "Acme", ownerId: new mongoose.Types.ObjectId() });

  assert.equal(business.expenseNumbering.prefix, "EXP");
  assert.equal(business.expenseNumbering.nextSequence, 1);
});

test("expense schema validates generic operating spend and GST recorded snapshot", async () => {
  const expense = new Expense({
    businessId: new mongoose.Types.ObjectId(),
    expenseNumber: "EXP-2026-0001",
    expenseDate: new Date("2026-08-01"),
    category: "Utilities",
    description: "Office internet",
    vendorName: "Broadband Vendor",
    amountBeforeTax: 1000,
    taxAmount: 180,
    totalAmount: 1180,
    paidAmount: 500,
    balanceAmount: 680,
    gstEnabled: true,
    gstRate: 18,
    gstType: "GST_RECORDED",
    gstSnapshot: {
      taxableValue: 1000,
      totalTax: 180,
      inputTaxCreditClaimed: false,
      wording: "GST recorded",
    },
    paymentStatus: "PAID",
    paymentMethod: "UPI",
    createdBy: new mongoose.Types.ObjectId(),
  });

  await assert.doesNotReject(() => expense.validate());
  assert.equal(expense.gstSnapshot.inputTaxCreditClaimed, false);
  assert.equal(expense.balanceAmount, 680);
});

test("expense partial payment has server-validated paid and balance meaning", async () => {
  const partial = await normalizeExpensePayload({
    businessId: new mongoose.Types.ObjectId(),
    payload: { amountBeforeTax: 1000, paidAmount: 400, paymentStatus: "PARTIAL", paymentMethod: "cash" },
  });
  const unpaid = await normalizeExpensePayload({ businessId: new mongoose.Types.ObjectId(), payload: { amountBeforeTax: 1000, paymentStatus: "UNPAID" } });
  const paid = await normalizeExpensePayload({ businessId: new mongoose.Types.ObjectId(), payload: { amountBeforeTax: 1000, paymentStatus: "PAID" } });

  assert.equal(partial.paidAmount, 400);
  assert.equal(partial.balanceAmount, 600);
  assert.equal(partial.paymentStatus, "PARTIAL");
  assert.equal(partial.paymentMethod, "CASH");
  assert.equal(unpaid.paidAmount, 0);
  assert.equal(unpaid.balanceAmount, 1000);
  assert.equal(paid.paidAmount, 1000);
  assert.equal(paid.balanceAmount, 0);
});

test("expense payment status cannot contradict paid amount", async () => {
  await assert.rejects(
    () => normalizeExpensePayload({ businessId: new mongoose.Types.ObjectId(), payload: { amountBeforeTax: 1000, paidAmount: 0, paymentStatus: "PARTIAL" } }),
    /does not match paid amount/
  );
  await assert.rejects(
    () => normalizeExpensePayload({ businessId: new mongoose.Types.ObjectId(), payload: { amountBeforeTax: 1000, paidAmount: 1200, paymentStatus: "PAID" } }),
    /cannot exceed total amount/
  );
});

test("expense schema rejects invalid categories, payment status, and negative amounts", async () => {
  const base = {
    businessId: new mongoose.Types.ObjectId(),
    expenseNumber: "EXP-2026-0002",
    expenseDate: new Date(),
    amountBeforeTax: 100,
    totalAmount: 100,
    createdBy: new mongoose.Types.ObjectId(),
  };

  await assert.rejects(() => new Expense({ ...base, category: "Inventory Purchase" }).validate());
  await assert.rejects(() => new Expense({ ...base, paymentStatus: "SETTLED" }).validate());
  await assert.rejects(() => new Expense({ ...base, amountBeforeTax: -1 }).validate());
});

test("expense model has tenant and reporting indexes", () => {
  const indexes = Expense.schema.indexes().map(([fields]) => Object.keys(fields).join(","));

  assert.equal(indexes.includes("businessId,expenseNumber"), true);
  assert.equal(indexes.includes("businessId,expenseDate"), true);
  assert.equal(indexes.includes("businessId,category,expenseDate"), true);
  assert.equal(indexes.includes("businessId,paymentStatus,expenseDate"), true);
});

test("expense categories remain generic operating-spend categories", () => {
  ["Rent", "Utilities", "Salary & Wages", "Software & Subscriptions", "Travel", "Marketing & Advertising", "Miscellaneous"].forEach((category) =>
    assert.equal(EXPENSE_CATEGORIES.includes(category), true)
  );
  assert.equal(EXPENSE_CATEGORIES.includes("Inventory Purchase"), false);
});

test("customer statement CSV uses authoritative statement rows and running balances", () => {
  const csv = buildStatementCsv({
    transactions: [
      { date: new Date("2026-08-01"), type: "INVOICE", reference: "INV-1", description: "Invoice", debit: 1000, credit: 0, runningBalance: 1000 },
      { date: new Date("2026-08-05"), type: "PAYMENT", reference: "PAY-1", description: "Payment", debit: 0, credit: 400, runningBalance: 600 },
      { date: new Date("2026-08-08"), type: "CREDIT_NOTE", reference: "CN-1", description: "Credit", debit: 0, credit: 100, runningBalance: 500 },
    ],
  });

  assert.match(csv, /"Date","Type","Reference","Description","Debit","Credit","Balance"/);
  assert.match(csv, /"INVOICE","INV-1","Invoice","1000.00","0.00","1000.00"/);
  assert.match(csv, /"PAYMENT","PAY-1","Payment","0.00","400.00","600.00"/);
  assert.match(csv, /"CREDIT_NOTE","CN-1","Credit","0.00","100.00","500.00"/);
});

test("customer statement supports user-facing type filters mapped to ledger events", () => {
  assert.equal(ledgerEventTypeForStatementType("CREDIT_NOTE"), "CREDIT");
  assert.equal(ledgerEventTypeForStatementType("PAYMENT_REVERSAL"), "REVERSAL");
  assert.equal(ledgerEventTypeForStatementType("INVOICE_CANCELLATION"), "REVERSAL");
  assert.equal(ledgerEventTypeForStatementType("PAYMENT"), "PAYMENT");
});

test("customer ledger is append-oriented and tenant indexed for statement reads", () => {
  const indexes = CustomerLedger.schema.indexes().map(([fields]) => Object.keys(fields).join(","));

  assert.equal(CustomerLedger.schema.path("businessId").options.required, true);
  assert.equal(CustomerLedger.schema.path("customerId").options.required, true);
  assert.equal(indexes.some((fields) => fields.includes("businessId") && fields.includes("customerId")), true);
});

test("commercial plan editing is controlled and validates pricing and limits", async () => {
  const picked = pickControlledPlanFields({ monthlyPrice: 1200, code: "free", unsafeJson: { root: true }, entitlements: { expenses: true } });

  assert.deepEqual(Object.keys(picked).sort(), ["entitlements", "monthlyPrice"]);
  assert.doesNotThrow(() => validatePlanPayload({ monthlyPrice: 1200, yearlyPrice: 12000, limits: { users: 2 } }));
  assert.throws(() => validatePlanPayload({ monthlyPrice: -1 }), /monthlyPrice/);
  await assert.doesNotReject(() => new CommercialPlan({ code: "growth", name: "Growth", entitlements: { expenses: true } }).validate());
});

test("industry catalogue separates industry, player type, operational family and reusable workflow modules", () => {
  const textile = industryCatalog.find((industry) => industry.code === "TEXTILE_APPAREL");
  const healthcare = industryCatalog.find((industry) => industry.code === "HEALTHCARE");
  const appointments = capabilityCatalog.find((capability) => capability.code === "APPOINTMENTS");

  assert.equal(Boolean(textile), true);
  assert.equal(textile.supportedPlayerTypes.some((player) => player.code === "MANUFACTURER"), true);
  assert.equal(healthcare.supportedPlayerTypes.some((player) => player.code === "CLINIC"), true);
  assert.equal(appointments.status, "IMPLEMENTED");
  assert.equal(appointments.moduleKey, "appointments_scheduling");
});

test("workspace preset resolution is deterministic and maps reusable workflow needs to modules", () => {
  const resolved = resolveWorkspacePreset({
    industryCode: "HEALTHCARE",
    playerTypeCode: "CLINIC",
    selectedNeeds: ["APPOINTMENTS", "COMMUNICATIONS"],
    numberOfUsers: 2,
  });

  assert.equal(resolved.industry.code, "HEALTHCARE");
  assert.equal(resolved.playerType.code, "CLINIC");
  assert.equal(resolved.businessModel, "SERVICE");
  assert.equal(resolved.recommendedModules.includes("communications"), true);
  assert.equal(resolved.recommendedModules.includes("appointments_scheduling"), true);
  assert.equal(resolved.futureCapabilities.some((item) => item.code === "APPOINTMENTS"), false);
});

test("preset resolution validates business model and preserves existing-business explicit apply semantics", () => {
  assert.throws(() => resolveWorkspacePreset({ businessModel: "HOSPITAL_APP" }), /Invalid business model/);
  assert.throws(() => resolveWorkspacePreset({ industryCode: "HEALTHCARE", playerTypeCode: "TEXTILE_EXPORTER" }), /Invalid player type/);
  const resolved = resolveWorkspacePreset({ industryCode: "OTHER", businessModel: "MIXED", selectedNeeds: ["EXPENSES"] });
  assert.equal(resolved.recommendedModules.includes("expenses"), true);
  assert.equal(resolved.recommendedPlan.recommendedPlanCode, "free");
});

test("plan recommendation uses needs without frontend-owned prices", () => {
  assert.equal(recommendPlanForProfile({ selectedNeeds: ["INVOICING"], numberOfUsers: 1 }).recommendedPlanCode, "free");
  assert.equal(recommendPlanForProfile({ selectedNeeds: ["INVENTORY", "PURCHASES"], numberOfUsers: 2 }).recommendedPlanCode, "growth");
  assert.equal(recommendPlanForProfile({ selectedNeeds: ["E_INVOICE"], numberOfUsers: 2 }).recommendedPlanCode, "pro");
});

test("transaction integration tests require a replica-set MongoDB and are not faked here", () => {
  assert.equal(process.env.MONGO_TRANSACTION_TESTS === "enabled", false);
});
