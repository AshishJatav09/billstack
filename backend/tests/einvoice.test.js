const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const EInvoiceMetadata = require("../src/models/EInvoiceMetadata");
const {
  assessInvoiceReadiness,
  buildEInvoicePayload,
  assertTransition,
} = require("../src/services/einvoice.service");

const makeInvoice = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  status: "issued",
  invoiceNumber: "INV-0001",
  invoiceDate: new Date("2026-08-01"),
  dueDate: new Date("2026-08-15"),
  customerDetails: { name: "ABC Traders", gstNumber: "29ABCDE1234F1Z5", address: "Bengaluru" },
  businessDetails: { name: "BillStack Demo", address: "Mumbai" },
  lineItems: [{ productName: "Consulting", quantity: 1, rate: 1000, discount: 0, itemTotal: 1180 }],
  subtotal: 1000,
  totalDiscount: 0,
  totalTax: 180,
  shippingCharges: 0,
  roundOff: 0,
  grandTotal: 1180,
  gstSnapshot: {
    gstin: "27ABCDE1234F1Z5",
    supplierStateCode: "27",
    placeOfSupplyCode: "29",
    taxableValue: 1000,
    cgst: 0,
    sgst: 0,
    utgst: 0,
    igst: 180,
    totalTax: 180,
    lines: [{ hsnSac: "9983", taxableValue: 1000, rate: 18, igst: 180, gstClassification: "TAXABLE" }],
  },
  ...overrides,
});

const business = {
  name: "BillStack Demo",
  address: "Mumbai",
  gstTaxId: "27ABCDE1234F1Z5",
  gstConfiguration: { enabled: true, gstin: "27ABCDE1234F1Z5", stateCode: "27" },
};
const customer = {
  name: "ABC Traders",
  billingAddress: "Bengaluru",
  gstNumber: "29ABCDE1234F1Z5",
  stateCode: "29",
};

test("e-invoice metadata defines tenant invoice and IRN unique indexes", () => {
  const indexes = EInvoiceMetadata.schema.indexes().map(([fields]) => fields);
  assert.ok(indexes.some((fields) => fields.businessId === 1 && fields.invoiceId === 1));
  assert.ok(indexes.some((fields) => fields.businessId === 1 && fields.irn === 1));
});

test("e-invoice readiness passes for valid GST snapshot", () => {
  const readiness = assessInvoiceReadiness({ invoice: makeInvoice(), business, customer });
  assert.equal(readiness.readiness, "READY");
  assert.deepEqual(readiness.errors, []);
});

test("e-invoice readiness reports missing GSTIN", () => {
  const readiness = assessInvoiceReadiness({
    invoice: makeInvoice({ customerDetails: { gstNumber: "" } }),
    business,
    customer: { ...customer, gstNumber: "" },
  });
  assert.equal(readiness.errors[0].code, "MISSING_GSTIN");
});

test("e-invoice readiness rejects invalid HSN/SAC and CGST/SGST mismatch", () => {
  const readiness = assessInvoiceReadiness({
    invoice: makeInvoice({
      gstSnapshot: {
        ...makeInvoice().gstSnapshot,
        igst: 0,
        cgst: 90,
        sgst: 90,
        lines: [{ hsnSac: "", taxableValue: 1000, rate: 18, cgst: 90, sgst: 90 }],
      },
    }),
    business,
    customer,
  });
  assert.ok(readiness.errors.some((error) => error.code === "INVALID_HSN_SAC"));
  assert.ok(readiness.errors.some((error) => error.code === "INVALID_GST_DATA"));
});

test("e-invoice readiness detects tax total mismatch", () => {
  const readiness = assessInvoiceReadiness({
    invoice: makeInvoice({ totalTax: 170 }),
    business,
    customer,
  });
  assert.ok(readiness.errors.some((error) => error.code === "TOTAL_MISMATCH"));
});

test("cancelled invoice is not eligible", () => {
  const readiness = assessInvoiceReadiness({
    invoice: makeInvoice({ status: "cancelled" }),
    business,
    customer,
  });
  assert.equal(readiness.errors[0].code, "NOT_ELIGIBLE");
});

test("legacy invoice without GST snapshot remains explicit", () => {
  const readiness = assessInvoiceReadiness({
    invoice: makeInvoice({ gstSnapshot: null }),
    business,
    customer,
  });
  assert.ok(readiness.errors.some((error) => error.code === "INVALID_GST_DATA"));
});

test("e-invoice payload is prepared without fake IRN", () => {
  const invoice = makeInvoice();
  const readiness = assessInvoiceReadiness({ invoice, business, customer });
  const payload = buildEInvoicePayload({ invoice, business, customer, readiness });
  assert.equal(payload.submissionConfigured, false);
  assert.equal(payload.document.invoiceNumber, "INV-0001");
  assert.equal(payload.items[0].hsnSac, "9983");
  assert.equal(payload.totals.igst, 180);
});

test("e-invoice lifecycle transitions are enforced", () => {
  assert.doesNotThrow(() => assertTransition("READY", "SUBMISSION_PENDING"));
  assert.doesNotThrow(() => assertTransition("SUBMISSION_PENDING", "GENERATED"));
  assert.throws(() => assertTransition("GENERATED", "READY"), /Invalid e-invoice transition/);
});
