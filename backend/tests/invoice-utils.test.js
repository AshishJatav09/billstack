const test = require("node:test");
const assert = require("node:assert/strict");

const { buildInvoiceNumber, buildInvoiceTotals } = require("../src/utils/invoice");

test("buildInvoiceTotals calculates payment state and totals", () => {
  const result = buildInvoiceTotals({
    lineItems: [
      { productId: "1", quantity: 2, rate: 100, taxRate: 18, discount: 10 },
      { productId: "2", quantity: 1, rate: 200, taxRate: 36, discount: 0 },
    ],
    shippingCharges: 50,
    roundOff: -4,
    amountPaid: 100,
  });

  assert.equal(result.subtotal, 400);
  assert.equal(result.totalTax, 104.4);
  assert.equal(result.totalDiscount, 20);
  assert.equal(result.grandTotal, 530.4);
  assert.equal(result.balanceDue, 430.4);
  assert.equal(result.paymentStatus, "partial");
});

test("buildInvoiceNumber applies prefix, year, and padded sequence", () => {
  const invoiceNumber = buildInvoiceNumber({
    prefix: "BILL",
    format: "INV-{YYYY}-{0001}",
    sequence: 12,
    date: new Date("2026-04-24T00:00:00.000Z"),
  });

  assert.equal(invoiceNumber, "BILL-2026-0012");
});
