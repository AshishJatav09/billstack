const test = require("node:test");
const assert = require("node:assert/strict");

const MessageDelivery = require("../src/models/MessageDelivery");
const MessageTemplate = require("../src/models/MessageTemplate");
const ReminderRule = require("../src/models/ReminderRule");
const ScheduledReminder = require("../src/models/ScheduledReminder");
const { deriveFinancialState } = require("../src/services/financial-read.service");
const { renderTemplate } = require("../src/services/communication.service");
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
});

test("template rendering only permits known variables", () => {
  const output = renderTemplate("Hi {{customer_name}}, pay {{outstanding_amount}} {{unsafe}}", {
    customer_name: "Riya",
    outstanding_amount: "2000.00",
    unsafe: "SHOULD_NOT_RENDER",
  });
  assert.equal(output, "Hi Riya, pay 2000.00 ");
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
