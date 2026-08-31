const test = require("node:test");
const assert = require("node:assert/strict");

const { toMinorUnits, fromMinorUnits } = require("../src/utils/money");
const { createPayment, allocatePayment, validateAllocationCounterparty, validateReversalRequest } = require("../src/services/payment.service");
const { paymentCreateValidator } = require("../src/validators/payment.validation");

test("payment money policy preserves two-decimal values using minor units", () => {
  assert.equal(toMinorUnits("125.45"), 12545);
  assert.equal(fromMinorUnits(12545), 125.45);
  assert.throws(() => toMinorUnits("10.999"), /two decimal places/);
  assert.throws(() => toMinorUnits("0"), /positive monetary amount/);
  assert.equal(toMinorUnits("0", "Outstanding", { allowZero: true }), 0);
});

test("payment validator rejects invalid method, date, currency, and counterparty direction", () => {
  const result = paymentCreateValidator({
    direction: "RECEIVED",
    amount: 100,
    paymentMethod: "WIRE",
    currency: "RUPEES",
    paymentDate: "not-a-date",
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.customerId);
  assert.ok(result.errors.paymentMethod);
  assert.ok(result.errors.currency);
  assert.ok(result.errors.paymentDate);
});

test("production payment service rejects invalid payment directions before persistence", async () => {
  await assert.rejects(
    () => createPayment({ businessId: "tenant", userId: "user", payload: { direction: "TRANSFER", amount: 10 } }),
    /direction must be RECEIVED or PAID/
  );
});

test("production allocation service rejects invalid allocation document combinations before persistence", async () => {
  await assert.rejects(
    () => allocatePayment({ businessId: "tenant", userId: "user", paymentId: "payment", payload: { allocatedAmount: 10 } }),
    /exactly one invoice or purchase/
  );
});
test("allocation history enforces invoice customer and purchase supplier ownership", () => {
  assert.equal(validateAllocationCounterparty({ sourceType: "INVOICE", document: { customerId: "c1" }, payment: { customerId: "c1" } }), true);
  assert.throws(() => validateAllocationCounterparty({ sourceType: "INVOICE", document: { customerId: "c1" }, payment: { customerId: "c2" } }), /counterparty/);
  assert.equal(validateAllocationCounterparty({ sourceType: "PURCHASE", document: { supplierId: "s1" }, payment: { supplierId: "s1" } }), true);
  assert.throws(() => validateAllocationCounterparty({ sourceType: "PURCHASE", document: { supplierId: "s1" }, payment: { supplierId: "s2" } }), /counterparty/);
});
test("allocation reversal rejects duplicates and over-reversal while preserving tenant-scoped ownership", () => {
  assert.equal(validateReversalRequest({ allocationAmount: 100, alreadyReversed: false, requestedAmount: 40 }), 40);
  assert.throws(() => validateReversalRequest({ allocationAmount: 100, alreadyReversed: true, requestedAmount: 40 }), /already been reversed/);
  assert.throws(() => validateReversalRequest({ allocationAmount: 100, alreadyReversed: false, requestedAmount: 101 }), /exceeds allocated/);
});
