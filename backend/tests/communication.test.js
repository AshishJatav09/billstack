const test = require("node:test");
const assert = require("node:assert/strict");

const MessageDelivery = require("../src/models/MessageDelivery");
const MessageTemplate = require("../src/models/MessageTemplate");
const Payment = require("../src/models/Payment");
const PaymentAllocation = require("../src/models/PaymentAllocation");
const PaymentAllocationReversal = require("../src/models/PaymentAllocationReversal");
const ReminderRule = require("../src/models/ReminderRule");
const ScheduledReminder = require("../src/models/ScheduledReminder");
const Invoice = require("../src/models/Invoice");
const Business = require("../src/models/Business");
const FinancialMigrationProvenance = require("../src/models/FinancialMigrationProvenance");
const { deriveFinancialState } = require("../src/services/financial-read.service");
const {
  ALLOWED_TEMPLATE_VARS,
  DEFAULT_TEMPLATE_DEFINITIONS,
  TEMPLATE_CATEGORIES,
  buildVariables,
  defaultCategoryForReminderTrigger,
  dispatchInvoiceIssuedAutomation,
  dispatchPaymentRecordedAutomation,
  ensureDefaultTemplates,
  findTemplate,
  generateReminderRuleName,
  createReminderRule,
  normalizePaymentCondition,
  normalizeReminderRuleInput,
  renderTemplate,
  scheduledDateForRule,
  sendQuoteMessage,
  validateTemplateVariables,
} = require("../src/services/communication.service");
const { getWhatsAppProviderStatus, sendWhatsAppMessage } = require("../src/services/whatsapp-provider.service");

test("communication models are tenant scoped and idempotency indexed", () => {
  const deliveryIndexes = MessageDelivery.schema.indexes().map(([fields]) => fields);
  const reminderIndexes = ScheduledReminder.schema.indexes().map(([fields]) => fields);
  const ruleIndexes = ReminderRule.schema.indexes().map(([fields]) => fields);
  const templateIndexes = MessageTemplate.schema.indexes().map(([fields]) => fields);
  assert.ok(deliveryIndexes.some((fields) => fields.businessId === 1 && fields.sourceKey === 1));
  assert.ok(reminderIndexes.some((fields) => fields.businessId === 1 && fields.sourceKey === 1));
  assert.ok(ruleIndexes.some((fields) => fields.businessId === 1 && fields.sourceKey === 1));
  assert.ok(templateIndexes.some((fields) => fields.businessId === 1 && fields.code === 1 && fields.channel === 1));
  assert.ok(templateIndexes.some((fields) => fields.businessId === 1 && fields.category === 1 && fields.channel === 1 && fields.isDefault === 1));
  assert.ok(MessageTemplate.schema.path("isDefault"));
  assert.ok(ReminderRule.schema.path("category"));
  assert.ok(ReminderRule.schema.path("trigger").enumValues.includes("INVOICE_ISSUED"));
  assert.ok(ReminderRule.schema.path("trigger").enumValues.includes("PAYMENT_RECORDED"));
  assert.ok(ReminderRule.schema.path("condition").enumValues.includes("FULL_PAYMENT"));
});

test("template rendering resolves known variables and rejects unsupported placeholders", () => {
  assert.equal(renderTemplate("Hi {{customer_name}}, pay {{outstanding_amount}}", {
    customer_name: "Riya",
    outstanding_amount: "2000.00",
  }), "Hi Riya, pay 2000.00");
  assert.throws(() => renderTemplate("Hi {{customer_name}}, pay {{unsafe}}", {
    customer_name: "Riya",
    unsafe: "SHOULD_NOT_RENDER",
  }), /Unsupported/);
});

test("template variable validation fails before unresolved content can be sent", () => {
  assert.equal(ALLOWED_TEMPLATE_VARS.has("customer_name"), true);
  assert.equal(TEMPLATE_CATEGORIES.includes("PAYMENT_REMINDER"), true);
  assert.doesNotThrow(() => validateTemplateVariables("Hi {{customer_name}}", { customer_name: "Riya" }));
  assert.throws(() => validateTemplateVariables("Hi {{customer_name}}", {}), /unavailable/);
  assert.throws(() => validateTemplateVariables("Hi {{not_supported}}"), /Unsupported/);
});

test("standard templates are professional, channel-specific and use only supported placeholders", () => {
  const byCategoryChannel = new Set(DEFAULT_TEMPLATE_DEFINITIONS.map((template) => `${template.category}:${template.channel}`));
  for (const category of ["INVOICE_CREATED", "DUE_TODAY", "PAYMENT_OVERDUE", "PAYMENT_REMINDER", "PAYMENT_RECEIVED", "CREDIT_NOTE", "SALES_RETURN", "QUOTATION"]) {
    assert.ok(byCategoryChannel.has(`${category}:EMAIL`), `${category} EMAIL default missing`);
  }
  for (const category of ["INVOICE_CREATED", "DUE_TODAY", "PAYMENT_OVERDUE", "PAYMENT_REMINDER", "PAYMENT_RECEIVED", "CREDIT_NOTE", "SALES_RETURN", "QUOTATION"]) {
    assert.ok(byCategoryChannel.has(`${category}:WHATSAPP`), `${category} WHATSAPP default missing`);
  }
  for (const template of DEFAULT_TEMPLATE_DEFINITIONS) {
    assert.doesNotThrow(() => validateTemplateVariables(`${template.subject || ""}\n${template.body || ""}`), `${template.name} has unsupported variables`);
    if (template.channel === "EMAIL") {
      assert.match(template.body, /Hi {{customer_name}},/);
      assert.match(template.body, /Regards,\n{{business_name}}/);
    }
    if (template.channel === "WHATSAPP") {
      assert.ok(template.body.length < 420, `${template.name} should stay mobile-friendly`);
    }
  }
});

test("communication variable context resolves supported invoice and business placeholders", () => {
  const vars = buildVariables({
    business: { name: "Acme", phone: "+91 90000 00000", email: "billing@acme.test" },
    invoice: { invoiceNumber: "INV-1", grandTotal: 1200, balanceDue: 300, amountPaid: 900, dueDate: "2026-09-12", customerDetails: { name: "Fallback" }, businessDetails: {} },
    customer: { name: "Riya" },
  });
  for (const key of ["customer_name", "invoice_number", "invoice_amount", "outstanding_amount", "due_date", "business_name", "business_phone", "business_email", "payment_amount"]) {
    assert.notEqual(vars[key], undefined);
  }
  assert.equal(renderTemplate("Hi {{customer_name}}\n{{business_phone}}\n{{business_email}}", vars), "Hi Riya\n+91 90000 00000\nbilling@acme.test");
});

test("quotation communication support uses real templates, tenant route and source idempotency", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const routeSource = fs.readFileSync(path.join(__dirname, "../src/routes/communication.routes.js"), "utf8");
  const serviceSource = fs.readFileSync(path.join(__dirname, "../src/services/communication.service.js"), "utf8");
  assert.equal(typeof sendQuoteMessage, "function");
  assert.match(routeSource, /\/quotes\/:quoteId\/send/);
  assert.match(serviceSource, /Quote\.findOne\(\{ _id: quoteId, businessId \}/);
  assert.match(serviceSource, /category: "QUOTATION"/);
  assert.match(serviceSource, /SEND:QUOTE:/);
});

test("quotation template variables render customer, business and quote values", () => {
  const vars = buildVariables({
    business: { name: "The Office On Rent", phone: "8349523485", email: "info@nemnidhi.com" },
    quote: { quoteNumber: "QUO-1", grandTotal: 14160, validUntil: "2026-09-30" },
    customer: { name: "Abhishek" },
  });
  assert.equal(vars.quotation_number, "QUO-1");
  assert.equal(vars.quotation_amount, "14160.00");
  assert.equal(renderTemplate("Quote {{quotation_number}} for {{customer_name}}", vars), "Quote QUO-1 for Abhishek");
});

test("payment template context exposes recorded payment values without fabrication", () => {
  const vars = buildVariables({
    business: { name: "Acme", phone: "+91 90000 00000", email: "billing@acme.test" },
    invoice: { invoiceNumber: "INV-9", grandTotal: 1200, balanceDue: 0, dueDate: "2026-09-12", customerDetails: { name: "Fallback" }, businessDetails: {} },
    customer: { name: "Riya" },
    payment: { amount: 1200, paymentDate: "2026-09-02", referenceNumber: "UPI123" },
  });
  assert.equal(vars.payment_amount, "1200.00");
  assert.equal(vars.payment_reference, "UPI123");
  assert.ok(vars.payment_date);
  assert.equal(renderTemplate("Paid {{payment_amount}} on {{payment_date}} ref {{payment_reference}}", vars).includes("UPI123"), true);
});

test("standard template sync updates system templates without overwriting custom defaults", async () => {
  const originalFindOne = MessageTemplate.findOne;
  const originalFindOneAndUpdate = MessageTemplate.findOneAndUpdate;
  const originalUpdateMany = MessageTemplate.updateMany;
  const updates = [];
  const customDefault = { _id: "custom-default", code: "CUSTOM_OVERDUE", isDefault: true, isSystem: false };
  MessageTemplate.findOne = (filter) => ({
    session: () => {
      if (filter.isDefault === true && filter.category === "PAYMENT_OVERDUE" && filter.channel === "EMAIL") return Promise.resolve(customDefault);
      if (filter.$or?.some((item) => item.code === "PAYMENT_OVERDUE_EMAIL_DEFAULT")) return Promise.resolve({ _id: "system-overdue", code: "PAYMENT_OVERDUE_EMAIL_DEFAULT", isSystem: true });
      return Promise.resolve(null);
    },
  });
  MessageTemplate.updateMany = (...args) => {
    updates.push({ type: "updateMany", args });
    return Promise.resolve({ modifiedCount: 0 });
  };
  MessageTemplate.findOneAndUpdate = (filter, update) => {
    updates.push({ type: "findOneAndUpdate", filter, update });
    return Promise.resolve({ _id: filter._id || "new-system", ...update.$set });
  };
  try {
    await ensureDefaultTemplates({ businessId: "tenant-a", createdBy: "user-a" });
    const overdueUpdate = updates.find((item) => item.type === "findOneAndUpdate" && item.update.$set?.category === "PAYMENT_OVERDUE" && item.update.$set?.name === "Payment Reminder - Standard");
    assert.equal(overdueUpdate.update.$set.isSystem, true);
    assert.equal(overdueUpdate.update.$set.isDefault, false);
    assert.match(overdueUpdate.update.$set.body, /currently overdue/);
  } finally {
    MessageTemplate.findOne = originalFindOne;
    MessageTemplate.findOneAndUpdate = originalFindOneAndUpdate;
    MessageTemplate.updateMany = originalUpdateMany;
  }
});

test("WhatsApp provider reports NOT_CONFIGURED without faking delivery", async () => {
  const status = getWhatsAppProviderStatus();
  assert.equal(typeof status.configured, "boolean");
  await assert.rejects(() => sendWhatsAppMessage({}), /not configured|contract is not configured/i);
});

test("fully paid derived invoice state cancels reminder eligibility", () => {
  const state = deriveFinancialState({
    sourceType: "INVOICE",
    migrated: true,
    allocatedAmount: 50000,
    document: { grandTotal: 50000, amountPaid: 0, balanceDue: 50000, paymentStatus: "unpaid" },
  });
  assert.equal(state.outstandingAmount, 0);
  assert.equal(state.paymentStatus, "paid");
});

test("partial payment reminder amount uses current derived outstanding", () => {
  const state = deriveFinancialState({
    sourceType: "INVOICE",
    migrated: true,
    allocatedAmount: 30000,
    document: { grandTotal: 50000, amountPaid: 0, balanceDue: 50000, paymentStatus: "unpaid" },
  });
  assert.equal(state.outstandingAmount, 20000);
  assert.equal(state.paymentStatus, "partial");
});

test("delivery states include retry and webhook delivery lifecycle", () => {
  const statusPath = MessageDelivery.schema.path("status").enumValues;
  for (const status of ["QUEUED", "SCHEDULED", "SENT", "DELIVERED", "READ", "FAILED", "CANCELLED", "SKIPPED"]) {
    assert.ok(statusPath.includes(status));
  }
});

test("reminder rule names are generated from standard configuration", () => {
  assert.equal(generateReminderRuleName({ trigger: "BEFORE_DUE_DATE", offsetDays: 3 }), "3 days before due date");
  assert.equal(generateReminderRuleName({ trigger: "ON_DUE_DATE" }), "On due date");
  assert.equal(generateReminderRuleName({ trigger: "AFTER_DUE_DATE", offsetDays: 2 }), "2 days after due date");
  assert.equal(generateReminderRuleName({ trigger: "RECURRING_OVERDUE", repeatEveryDays: 4 }), "Every 4 days after overdue");
});

test("reminder triggers map to sensible default template categories", () => {
  assert.equal(defaultCategoryForReminderTrigger("BEFORE_DUE_DATE"), "PAYMENT_REMINDER");
  assert.equal(defaultCategoryForReminderTrigger("ON_DUE_DATE"), "DUE_TODAY");
  assert.equal(defaultCategoryForReminderTrigger("AFTER_DUE_DATE"), "PAYMENT_OVERDUE");
  assert.equal(defaultCategoryForReminderTrigger("RECURRING_OVERDUE"), "PAYMENT_OVERDUE");
});

test("reminder scheduling supports before, on, after and recurring overdue dates", () => {
  const dueDate = "2026-09-10T00:00:00";
  const localParts = (value) => [value.getFullYear(), value.getMonth() + 1, value.getDate(), value.getHours(), value.getMinutes()];
  assert.deepEqual(localParts(scheduledDateForRule({ dueDate, trigger: "BEFORE_DUE_DATE", offsetDays: 3, sendTime: "10:30" })), [2026, 9, 7, 10, 30]);
  assert.deepEqual(localParts(scheduledDateForRule({ dueDate, trigger: "ON_DUE_DATE", sendTime: "09:00" })), [2026, 9, 10, 9, 0]);
  assert.deepEqual(localParts(scheduledDateForRule({ dueDate, trigger: "AFTER_DUE_DATE", offsetDays: 2, sendTime: "11:15" })), [2026, 9, 12, 11, 15]);
  assert.deepEqual(localParts(scheduledDateForRule({ dueDate, trigger: "RECURRING_OVERDUE", repeatEveryDays: 4, sendTime: "12:00" })), [2026, 9, 14, 12, 0]);
  assert.deepEqual(localParts(scheduledDateForRule({ dueDate, trigger: "RECURRING_OVERDUE", repeatEveryDays: 4, sendTime: "12:00", previousScheduledFor: "2026-09-14T12:00:00" })), [2026, 9, 18, 12, 0]);
});

test("reminder rule validation clears irrelevant fields and rejects unsafe schedules", () => {
  assert.deepEqual(
    normalizeReminderRuleInput({ trigger: "ON_DUE_DATE", offsetDays: 9, repeatEveryDays: 4, channel: "EMAIL", sendTime: "10:00" }),
    {
      trigger: "ON_DUE_DATE",
      channel: "EMAIL",
      sendTime: "10:00",
      offsetDays: 0,
      repeatEveryDays: 0,
      name: "On due date",
      timezone: "Asia/Kolkata",
      templateId: null,
      category: "DUE_TODAY",
      isEnabled: true,
      condition: "ANY_PAYMENT",
      sourceKey: "RULE:ON_DUE_DATE:0:0:EMAIL:DUE_TODAY:DEFAULT:10:00:ANY_PAYMENT",
    }
  );
  assert.throws(() => normalizeReminderRuleInput({ trigger: "BEFORE_DUE_DATE", offsetDays: 0, channel: "EMAIL", sendTime: "10:00" }), /positive/);
  assert.throws(() => normalizeReminderRuleInput({ trigger: "RECURRING_OVERDUE", repeatEveryDays: 0, channel: "EMAIL", sendTime: "10:00" }), /at least 1 day/);
  assert.throws(() => normalizeReminderRuleInput({ trigger: "ON_DUE_DATE", channel: "EMAIL", sendTime: "25:00" }), /invalid/);
});

test("event automation rules default off and normalize categories/conditions", () => {
  const invoiceRule = normalizeReminderRuleInput({ trigger: "INVOICE_ISSUED", channel: "EMAIL" });
  assert.equal(invoiceRule.name, "Invoice Issued");
  assert.equal(invoiceRule.category, "INVOICE_CREATED");
  assert.equal(invoiceRule.isEnabled, false);
  assert.equal(invoiceRule.sendTime, "");
  assert.equal(invoiceRule.offsetDays, 0);

  const paymentRule = normalizeReminderRuleInput({ trigger: "PAYMENT_RECORDED", channel: "EMAIL", condition: "FULL_PAYMENT", isEnabled: true });
  assert.equal(paymentRule.category, "PAYMENT_RECEIVED");
  assert.equal(paymentRule.condition, "FULL_PAYMENT");
  assert.equal(paymentRule.isEnabled, true);
  assert.throws(() => normalizePaymentCondition("PAID_SOMETIME"), /Invalid payment automation condition/);
});

test("enabled event automation rules do not enter scheduled reminder materialization", async () => {
  const originalRuleFindOneAndUpdate = ReminderRule.findOneAndUpdate;
  const originalInvoiceFind = Invoice.find;
  let invoiceFindCalls = 0;
  ReminderRule.findOneAndUpdate = (_filter, update) => Promise.resolve({
    _id: "rule-id",
    businessId: update.$setOnInsert.businessId,
    sourceKey: update.$setOnInsert.sourceKey,
    ...update.$set,
  });
  Invoice.find = () => {
    invoiceFindCalls += 1;
    throw new Error("Event rules must not materialize scheduled reminders");
  };
  try {
    const invoiceRule = await createReminderRule({
      businessId: "64f000000000000000000041",
      createdBy: "64f000000000000000000042",
      body: { trigger: "INVOICE_ISSUED", channel: "EMAIL", isEnabled: true },
    });
    assert.equal(invoiceRule.trigger, "INVOICE_ISSUED");

    const paymentRule = await createReminderRule({
      businessId: "64f000000000000000000041",
      createdBy: "64f000000000000000000042",
      body: { trigger: "PAYMENT_RECORDED", channel: "EMAIL", condition: "FULL_PAYMENT", isEnabled: true },
    });
    assert.equal(paymentRule.trigger, "PAYMENT_RECORDED");
    assert.equal(invoiceFindCalls, 0);
  } finally {
    ReminderRule.findOneAndUpdate = originalRuleFindOneAndUpdate;
    Invoice.find = originalInvoiceFind;
  }
});

test("reminder UI exposes standard dynamic fields and failure reasons", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const page = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "features", "dashboard", "pages", "CommunicationsPage.jsx"), "utf8");
  assert.match(page, /Automation/);
  assert.match(page, /Trigger/);
  assert.match(page, /Days before due date/);
  assert.match(page, /Days after due date/);
  assert.match(page, /Repeat every X days/);
  assert.match(page, /Configured automation rules/);
  assert.match(page, /Event Based/);
  assert.match(page, /Payment Successfully Recorded/);
  assert.match(page, /Generated rule name/);
  assert.match(page, /row\.failureReason/);
  assert.doesNotMatch(page, /Offset days/);
  assert.match(page, /Use default template/);
  assert.match(page, /Set as default/);
  assert.match(page, /Preview only/);
});

test("template selection uses active specific templates or default fallback", async () => {
  const originalFindOne = MessageTemplate.findOne;
  const calls = [];
  const query = (row) => ({ session: () => Promise.resolve(row) });
  const defaultTemplate = { _id: "default", businessId: "tenant-a", channel: "EMAIL", category: "PAYMENT_OVERDUE", isActive: true, isDefault: true };
  const specificTemplate = { _id: "specific", businessId: "tenant-a", channel: "EMAIL", category: "PAYMENT_OVERDUE", isActive: true, isDefault: false };
  MessageTemplate.findOne = (filter) => {
    calls.push(filter);
    if (filter._id === "specific" && filter.businessId === "tenant-a" && filter.isActive === true) return query(specificTemplate);
    if (!filter._id && filter.businessId === "tenant-a" && filter.isDefault === true) return query(defaultTemplate);
    return query(null);
  };
  try {
    assert.equal(await findTemplate({ businessId: "tenant-a", channel: "EMAIL", category: "PAYMENT_OVERDUE", templateId: "specific" }), specificTemplate);
    assert.equal(await findTemplate({ businessId: "tenant-a", channel: "EMAIL", category: "PAYMENT_OVERDUE" }), defaultTemplate);
    const specificFilter = calls.find((filter) => filter._id === "specific");
    assert.equal(specificFilter.businessId, "tenant-a");
    assert.equal(specificFilter.channel, "EMAIL");
    assert.equal(specificFilter.category, "PAYMENT_OVERDUE");
    assert.equal(specificFilter.isActive, true);
  } finally {
    MessageTemplate.findOne = originalFindOne;
  }
});

test("inactive or mismatched templates cannot be selected", async () => {
  const originalFindOne = MessageTemplate.findOne;
  MessageTemplate.findOne = () => ({ session: () => Promise.resolve(null) });
  try {
    await assert.rejects(
      () => findTemplate({ businessId: "tenant-a", channel: "EMAIL", category: "PAYMENT_OVERDUE", templateId: "inactive-template" }),
      /Message template not found/
    );
  } finally {
    MessageTemplate.findOne = originalFindOne;
  }
});

test("invoice issued automation is off by default and creates no delivery", async () => {
  const originalInvoiceFindOne = Invoice.findOne;
  const originalBusinessFindOne = Business.findOne;
  const originalRuleFind = ReminderRule.find;
  const originalDelivery = MessageDelivery.findOneAndUpdate;
  const originalProvenanceFindOne = FinancialMigrationProvenance.findOne;
  let deliveries = 0;
  const businessId = "64f000000000000000000001";
  const invoiceId = "64f000000000000000000002";
  const customerId = "64f000000000000000000003";
  Invoice.findOne = () => ({ populate: function populate() { return this; }, session: () => Promise.resolve({ _id: invoiceId, businessId, customerId, status: "issued", isSampleData: false, invoiceNumber: "INV-1", grandTotal: 100, balanceDue: 100, customerDetails: { email: "riya@example.test" } }) });
  Business.findOne = () => ({ select: () => ({ session: () => Promise.resolve({ _id: businessId, name: "Acme" }) }) });
  FinancialMigrationProvenance.findOne = () => Promise.resolve(null);
  ReminderRule.find = () => ({ session: () => Promise.resolve([]) });
  MessageDelivery.findOneAndUpdate = () => { deliveries += 1; return Promise.resolve({}); };
  try {
    const rows = await dispatchInvoiceIssuedAutomation({ businessId, invoiceId, createdBy: customerId });
    assert.deepEqual(rows, []);
    assert.equal(deliveries, 0);
  } finally {
    Invoice.findOne = originalInvoiceFindOne;
    Business.findOne = originalBusinessFindOne;
    ReminderRule.find = originalRuleFind;
    MessageDelivery.findOneAndUpdate = originalDelivery;
    FinancialMigrationProvenance.findOne = originalProvenanceFindOne;
  }
});

test("invoice issued automation skips sample invoices before creating delivery rows", async () => {
  const originalInvoiceFindOne = Invoice.findOne;
  const originalBusinessFindOne = Business.findOne;
  const originalRuleFind = ReminderRule.find;
  const originalTemplateFindOne = MessageTemplate.findOne;
  const originalDelivery = MessageDelivery.findOneAndUpdate;
  const originalProvenanceFindOne = FinancialMigrationProvenance.findOne;
  let deliveryCalls = 0;
  const businessId = "64f000000000000000000011";
  const invoiceId = "64f000000000000000000012";
  const customerId = "64f000000000000000000013";
  const ruleId = "64f000000000000000000014";
  const templateId = "64f000000000000000000015";
  Invoice.findOne = () => ({ populate: function populate() { return this; }, session: () => Promise.resolve({ _id: invoiceId, businessId, customerId, status: "issued", isSampleData: true, invoiceNumber: "INV-2", grandTotal: 100, balanceDue: 100, customerDetails: { email: "riya@example.test" } }) });
  Business.findOne = () => ({ select: () => ({ session: () => Promise.resolve({ _id: businessId, name: "Acme" }) }) });
  FinancialMigrationProvenance.findOne = () => Promise.resolve(null);
  ReminderRule.find = () => ({ session: () => Promise.resolve([{ _id: ruleId, channels: ["EMAIL"], category: "INVOICE_CREATED", templateId, isEnabled: true }]) });
  MessageTemplate.findOne = () => ({ session: () => Promise.resolve({ _id: templateId, channel: "EMAIL", category: "INVOICE_CREATED", subject: "Invoice {{invoice_number}}", body: "Hi {{customer_name}}", isActive: true }) });
  MessageDelivery.findOneAndUpdate = (filter, update) => {
    deliveryCalls += 1;
    return Promise.resolve({ _id: "delivery", ...update.$setOnInsert });
  };
  try {
    const rows = await dispatchInvoiceIssuedAutomation({ businessId, invoiceId, createdBy: customerId });
    assert.deepEqual(rows, []);
    assert.equal(deliveryCalls, 0);
  } finally {
    Invoice.findOne = originalInvoiceFindOne;
    Business.findOne = originalBusinessFindOne;
    ReminderRule.find = originalRuleFind;
    MessageTemplate.findOne = originalTemplateFindOne;
    MessageDelivery.findOneAndUpdate = originalDelivery;
    FinancialMigrationProvenance.findOne = originalProvenanceFindOne;
  }
});

test("real issued invoice automation uses idempotent delivery key and provider gating", async () => {
  const originalInvoiceFindOne = Invoice.findOne;
  const originalBusinessFindOne = Business.findOne;
  const originalRuleFind = ReminderRule.find;
  const originalTemplateFindOne = MessageTemplate.findOne;
  const originalDelivery = MessageDelivery.findOneAndUpdate;
  const originalProvenanceFindOne = FinancialMigrationProvenance.findOne;
  const originalSmtpHost = process.env.SMTP_HOST;
  const originalSmtpUser = process.env.SMTP_USER;
  const originalSmtpPass = process.env.SMTP_PASS;
  const sourceKeys = [];
  const businessId = "64f000000000000000000031";
  const invoiceId = "64f000000000000000000032";
  const customerId = "64f000000000000000000033";
  const ruleId = "64f000000000000000000034";
  const templateId = "64f000000000000000000035";
  process.env.SMTP_HOST = "";
  process.env.SMTP_USER = "";
  process.env.SMTP_PASS = "";
  Invoice.findOne = () => ({ populate: function populate() { return this; }, session: () => Promise.resolve({ _id: invoiceId, businessId, customerId, status: "issued", isSampleData: false, invoiceNumber: "INV-4", grandTotal: 100, balanceDue: 100, customerDetails: { email: "riya@example.test" } }) });
  Business.findOne = () => ({ select: () => ({ session: () => Promise.resolve({ _id: businessId, name: "Acme" }) }) });
  FinancialMigrationProvenance.findOne = () => Promise.resolve(null);
  ReminderRule.find = () => ({ session: () => Promise.resolve([{ _id: ruleId, channels: ["EMAIL"], category: "INVOICE_CREATED", templateId, isEnabled: true }]) });
  MessageTemplate.findOne = () => ({ session: () => Promise.resolve({ _id: templateId, channel: "EMAIL", category: "INVOICE_CREATED", subject: "Invoice {{invoice_number}}", body: "Hi {{customer_name}}", isActive: true }) });
  MessageDelivery.findOneAndUpdate = (filter, update) => {
    sourceKeys.push(filter.sourceKey);
    return Promise.resolve({ _id: "delivery", ...update.$setOnInsert });
  };
  try {
    const rows = await dispatchInvoiceIssuedAutomation({ businessId, invoiceId, createdBy: customerId });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "SKIPPED");
    assert.match(rows[0].failureReason, /EMAIL provider is not configured/);
    assert.equal(sourceKeys[0], `AUTO:INVOICE_ISSUED:${invoiceId}:${ruleId}:EMAIL:${templateId}`);
  } finally {
    Invoice.findOne = originalInvoiceFindOne;
    Business.findOne = originalBusinessFindOne;
    ReminderRule.find = originalRuleFind;
    MessageTemplate.findOne = originalTemplateFindOne;
    MessageDelivery.findOneAndUpdate = originalDelivery;
    FinancialMigrationProvenance.findOne = originalProvenanceFindOne;
    process.env.SMTP_HOST = originalSmtpHost;
    process.env.SMTP_USER = originalSmtpUser;
    process.env.SMTP_PASS = originalSmtpPass;
  }
});

test("payment recorded automation only dispatches matching invoice allocation conditions", async () => {
  const originalAllocationFindOne = PaymentAllocation.findOne;
  const originalPaymentFindOne = Payment.findOne;
  const originalReversalFindOne = PaymentAllocationReversal.findOne;
  const originalInvoiceFindOne = Invoice.findOne;
  const originalBusinessFindOne = Business.findOne;
  const originalRuleFind = ReminderRule.find;
  const originalTemplateFindOne = MessageTemplate.findOne;
  const originalDelivery = MessageDelivery.findOneAndUpdate;
  const originalProvenanceFindOne = FinancialMigrationProvenance.findOne;
  const originalSmtpHost = process.env.SMTP_HOST;
  const originalSmtpUser = process.env.SMTP_USER;
  const originalSmtpPass = process.env.SMTP_PASS;
  const sourceKeys = [];
  const businessId = "64f000000000000000000021";
  const invoiceId = "64f000000000000000000022";
  const customerId = "64f000000000000000000023";
  const paymentId = "64f000000000000000000024";
  const allocationId = "64f000000000000000000025";
  const fullRule = "64f000000000000000000026";
  const partialRule = "64f000000000000000000027";
  const templateId = "64f000000000000000000028";
  process.env.SMTP_HOST = "";
  process.env.SMTP_USER = "";
  process.env.SMTP_PASS = "";
  PaymentAllocation.findOne = () => ({ session: () => Promise.resolve({ _id: allocationId, businessId, invoiceId, paymentId, allocatedAmount: 250 }) });
  Payment.findOne = () => ({ session: () => Promise.resolve({ _id: paymentId, status: "POSTED", direction: "RECEIVED", customerId, paymentDate: "2026-09-02", referenceNumber: "UPI123", toObject: () => ({ _id: paymentId, status: "POSTED", direction: "RECEIVED", customerId, paymentDate: "2026-09-02", referenceNumber: "UPI123" }) }) });
  PaymentAllocationReversal.findOne = () => ({ session: () => Promise.resolve(null) });
  Invoice.findOne = () => ({ populate: function populate() { return this; }, session: () => Promise.resolve({ _id: invoiceId, businessId, customerId, status: "issued", isSampleData: false, invoiceNumber: "INV-3", grandTotal: 1000, amountPaid: 250, balanceDue: 750, paymentStatus: "partial", customerDetails: { email: "riya@example.test" } }) });
  Business.findOne = () => ({ select: () => ({ session: () => Promise.resolve({ _id: businessId, name: "Acme" }) }) });
  FinancialMigrationProvenance.findOne = () => Promise.resolve(null);
  ReminderRule.find = () => ({ session: () => Promise.resolve([{ _id: fullRule, channels: ["EMAIL"], category: "PAYMENT_RECEIVED", templateId, condition: "FULL_PAYMENT", isEnabled: true }, { _id: partialRule, channels: ["EMAIL"], category: "PAYMENT_RECEIVED", templateId, condition: "PARTIAL_PAYMENT", isEnabled: true }]) });
  MessageTemplate.findOne = () => ({ session: () => Promise.resolve({ _id: templateId, channel: "EMAIL", category: "PAYMENT_RECEIVED", subject: "Payment {{payment_reference}}", body: "Paid {{payment_amount}} for {{invoice_number}}", isActive: true }) });
  MessageDelivery.findOneAndUpdate = (filter, update) => {
    sourceKeys.push(filter.sourceKey);
    return Promise.resolve({ _id: "delivery", ...update.$setOnInsert });
  };
  try {
    const rows = await dispatchPaymentRecordedAutomation({ businessId, allocationId, createdBy: customerId });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "SKIPPED");
    assert.equal(sourceKeys[0], `AUTO:PAYMENT_RECORDED:${allocationId}:${partialRule}:EMAIL:${templateId}`);
  } finally {
    PaymentAllocation.findOne = originalAllocationFindOne;
    Payment.findOne = originalPaymentFindOne;
    PaymentAllocationReversal.findOne = originalReversalFindOne;
    Invoice.findOne = originalInvoiceFindOne;
    Business.findOne = originalBusinessFindOne;
    ReminderRule.find = originalRuleFind;
    MessageTemplate.findOne = originalTemplateFindOne;
    MessageDelivery.findOneAndUpdate = originalDelivery;
    FinancialMigrationProvenance.findOne = originalProvenanceFindOne;
    process.env.SMTP_HOST = originalSmtpHost;
    process.env.SMTP_USER = originalSmtpUser;
    process.env.SMTP_PASS = originalSmtpPass;
  }
});
