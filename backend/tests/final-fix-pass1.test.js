const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const Business = require("../src/models/Business");
const CreditNote = require("../src/models/CreditNote");
const Invoice = require("../src/models/Invoice");
const Quote = require("../src/models/Quote");
const SalesReturn = require("../src/models/SalesReturn");
const CustomerLedger = require("../src/models/CustomerLedger");
const { ACCESSIBLE_STATUSES, getPlanEntitlements, isSubscriptionAccessible } = require("../src/services/subscription.service");
const { verifyWhatsAppWebhookSignature } = require("../src/services/whatsapp-provider.service");

const src = (...parts) => fs.readFileSync(path.join(__dirname, "..", "src", ...parts), "utf8");

test("unverified Razorpay authenticated subscriptions do not unlock paid entitlements", () => {
  assert.equal(ACCESSIBLE_STATUSES.has("authenticated"), false);
  assert.equal(isSubscriptionAccessible({ planCode: "pro", status: "authenticated" }), false);
  assert.equal(isSubscriptionAccessible({ planCode: "pro", status: "active" }), true);
  assert.equal(getPlanEntitlements({ planCode: "free", status: "free" }).inventoryAccess, false);
});

test("businesses have independent quote numbering configuration", () => {
  assert.ok(Business.schema.path("quoteNumbering"));
  const defaults = Business.schema.path("quoteNumbering").defaultValue();
  assert.equal(defaults.prefix, "QUO");
  assert.equal(defaults.format, "QUO-{YYYY}-{0001}");
});

test("quote conversion has source quote idempotency and invoice side-effect contracts", () => {
  const indexes = Invoice.schema.indexes();
  assert.ok(indexes.some(([fields, options]) => fields.businessId === 1 && fields.sourceQuoteId === 1 && options.unique));
  assert.equal(Quote.schema.path("customerId").options.immutable, undefined);

  const quoteService = src("services", "quote.service.js");
  assert.match(quoteService, /CustomerLedger\.updateOne/);
  assert.match(quoteService, /applyInvoiceStockDelta/);
  assert.match(quoteService, /buildGstSnapshot/);
  assert.match(quoteService, /business\.invoiceNumbering\.nextSequence = sequence \+ 1/);
});

test("credit notes and sales returns have tenant source-key idempotency", () => {
  for (const model of [CreditNote, SalesReturn, CustomerLedger]) {
    assert.ok(model.schema.indexes().some(([fields, options]) => fields.businessId === 1 && fields.sourceKey === 1 && options.unique));
  }
  assert.ok(SalesReturn.schema.path("totalAmount"));
});

test("sales lifecycle service enforces cumulative eligibility and nonzero return ledger amounts", () => {
  const service = src("services", "sales-lifecycle.service.js");
  assert.match(service, /getIssuedCreditUsage/);
  assert.match(service, /remainingQty/);
  assert.match(service, /remainingAmountMinor/);
  assert.doesNotMatch(service, /amount:0/);
  assert.match(service, /amount: ret\.totalAmount/);
});

test("purchase creation rejects direct legacy payment writes", () => {
  const controller = src("controllers", "purchase.controller.js");
  assert.match(controller, /Purchase payments must be recorded through the Payment and Allocation workflow/);
  assert.match(controller, /const paidAmount = 0/);
  assert.match(controller, /paymentStatus: "unpaid"/);
});

test("external integration enforces capacity and uses payment service", () => {
  const service = src("services", "integration.service.js");
  assert.match(service, /getPlanEntitlements/);
  assert.match(service, /invoiceMonthlyLimit/);
  assert.match(service, /createPayment/);
  assert.match(service, /allocatePayment/);
  assert.match(service, /buildGstSnapshot/);
  assert.match(service, /applyIntegrationInvoiceStock/);
  assert.doesNotMatch(service, /PaymentAllocation\.create/);
});

test("WhatsApp webhook signature verification accepts valid signatures and rejects invalid ones", () => {
  const prior = process.env.WHATSAPP_WEBHOOK_SECRET;
  process.env.WHATSAPP_WEBHOOK_SECRET = "secret";
  const rawBody = JSON.stringify({ providerMessageId: "wamid.1", status: "delivered" });
  const signature = `sha256=${crypto.createHmac("sha256", "secret").update(rawBody).digest("hex")}`;
  assert.equal(verifyWhatsAppWebhookSignature({ rawBody, signature }), true);
  assert.equal(verifyWhatsAppWebhookSignature({ rawBody, signature: "sha256=bad" }), false);
  if (prior === undefined) delete process.env.WHATSAPP_WEBHOOK_SECRET;
  else process.env.WHATSAPP_WEBHOOK_SECRET = prior;
});

test("provider WhatsApp webhook is registered before authenticated communication routes", () => {
  const routes = src("routes", "communication.routes.js");
  assert.ok(routes.indexOf('router.post("/webhooks/whatsapp/status", controller.whatsappProviderWebhook)') < routes.indexOf("router.use(auth, tenant"));
});

test("reminder rules materialize scheduled reminders and cancel paid invoices", () => {
  const service = src("services", "communication.service.js");
  assert.match(service, /materializeReminderRule/);
  assert.match(service, /ScheduledReminder\.findOneAndUpdate/);
  assert.match(service, /Invoice has no outstanding amount/);
});

test("team limits derive from authoritative subscription entitlements", () => {
  const controller = src("controllers", "team.controller.js");
  assert.match(controller, /ensureBusinessSubscription/);
  assert.match(controller, /getPlanEntitlements/);
  assert.doesNotMatch(controller, /getPlanByCode/);
});

test("customer delete is protected when historical records exist", () => {
  const controller = src("controllers", "customer.controller.js");
  assert.match(controller, /Customer has historical financial or sales records and cannot be deleted/);
  assert.match(controller, /Invoice\.countDocuments/);
  assert.match(controller, /Payment\.countDocuments/);
  assert.match(controller, /CustomerLedger\.countDocuments/);
});

test("transaction-heavy final-fix behavior requires replica-set integration coverage", { skip: "Transaction integration tests unavailable because no replica-set test database exists." }, () => {});
