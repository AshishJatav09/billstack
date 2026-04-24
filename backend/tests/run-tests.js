const assert = require("node:assert/strict");

const { buildInvoiceNumber, buildInvoiceTotals } = require("../src/utils/invoice");
const tenantMiddleware = require("../src/middlewares/tenant.middleware");
const { PLAN_DEFINITIONS } = require("../src/constants/plans");

const run = (name, fn) => {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
};

run("buildInvoiceTotals calculates payment state and totals", () => {
  const result = buildInvoiceTotals({
    lineItems: [
      { productId: "1", quantity: 2, rate: 100, tax: 18, discount: 10 },
      { productId: "2", quantity: 1, rate: 200, tax: 36, discount: 0 },
    ],
    shippingCharges: 50,
    roundOff: -4,
    amountPaid: 100,
  });

  assert.equal(result.subtotal, 400);
  assert.equal(result.totalTax, 54);
  assert.equal(result.totalDiscount, 10);
  assert.equal(result.grandTotal, 490);
  assert.equal(result.balanceDue, 390);
  assert.equal(result.paymentStatus, "partial");
});

run("buildInvoiceNumber applies prefix, year, and padded sequence", () => {
  const invoiceNumber = buildInvoiceNumber({
    prefix: "BILL",
    format: "INV-{YYYY}-{0001}",
    sequence: 12,
    date: new Date("2026-04-24T00:00:00.000Z"),
  });

  assert.equal(invoiceNumber, "BILL-2026-0012");
});

run("tenant middleware blocks cross-business header access", () => {
  const req = {
    user: {
      businessId: {
        toString: () => "tenant-123",
      },
    },
    headers: {
      "x-business-id": "other-tenant",
    },
    params: {},
  };

  assert.throws(() => tenantMiddleware(req, {}, () => {}), /Cross-business access is not allowed/);
});

run("free plan invoice limit stays capped at 20", () => {
  assert.equal(PLAN_DEFINITIONS.free.invoiceMonthlyLimit, 20);
});

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("All backend smoke tests passed.");
