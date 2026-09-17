const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeBusinessGst } = require("../../shared/gst-policy.cjs");
const { buildTaxDocument } = require("../src/utils/tax-document");
const business = { gstConfiguration: { enabled: true, gstin: "23CGZPB7175E1Z5", stateCode: "23", state: "Madhya Pradesh" }, defaultTaxSettings: { taxMode: "exclusive" } };
test("GSTIN and business state cannot contradict each other", () => {
  assert.equal(normalizeBusinessGst(business.gstConfiguration).stateCode, "23");
  assert.throws(() => normalizeBusinessGst({ ...business.gstConfiguration, stateCode: "27", state: "Maharashtra" }), /GSTIN belongs to Madhya Pradesh/);
  assert.equal(normalizeBusinessGst({ enabled: true, gstin: "27ABCDE1234F1Z5" }).state, "Maharashtra");
});
for (const [pos, rate, cgst, sgst, igst] of [["23",18,900,900,0],["27",18,0,0,1800],["23",5,250,250,0],["24",5,0,0,500]]) test(`GST ${pos} at ${rate}%`, () => {
  const { totals, gstSnapshot } = buildTaxDocument({ business, counterparty: {}, placeOfSupplyCode: pos, lineItems: [{ quantity: 1, rate: 10000, taxRate: rate }] });
  assert.equal(gstSnapshot.cgst, cgst); assert.equal(gstSnapshot.sgst, sgst); assert.equal(gstSnapshot.igst, igst);
  assert.equal(totals.grandTotal, 10000 + cgst + sgst + igst);
});
test("unknown POS blocks GST issue; disabled GST preserves existing behavior", () => {
  assert.throws(() => buildTaxDocument({ business, counterparty: {}, lineItems: [{ quantity: 1, rate: 10000, taxRate: 18 }] }), /Place of Supply/);
  assert.equal(buildTaxDocument({ business: { gstConfiguration: { enabled: false } }, counterparty: {}, lineItems: [{ quantity: 1, rate: 10000, taxRate: 18 }] }).gstSnapshot, null);
});
test("inclusive configuration cannot silently calculate exclusive GST", () => {
  assert.throws(() => buildTaxDocument({ business: { ...business, defaultTaxSettings: { taxMode: "inclusive" } }, counterparty: { stateCode: "23" }, lineItems: [] }), /Tax Inclusive is not supported/);
});
test("mixed line rates preserve component and document totals", () => {
  const { totals, gstSnapshot } = buildTaxDocument({ business, counterparty: { stateCode: "23" }, lineItems: [{ quantity: 1, rate: 10000, taxRate: 18 }, { quantity: 1, rate: 10000, taxRate: 5 }] });
  assert.equal(gstSnapshot.cgst, 1150); assert.equal(gstSnapshot.sgst, 1150); assert.equal(gstSnapshot.totalTax, 2300); assert.equal(totals.grandTotal, 22300);
});
test("missing supplier GST evidence cannot silently become interstate", () => {
  assert.throws(() => buildTaxDocument({ business: { gstConfiguration: { enabled: true } }, counterparty: { stateCode: "23" }, lineItems: [] }), /valid GSTIN/);
});
test("legacy audit uses historical evidence only and never changes input", () => {
  const { auditGstSnapshot } = require("../src/utils/audit-gst-snapshot");
  const { gstSnapshot } = buildTaxDocument({ business, counterparty: { stateCode: "23" }, lineItems: [{ quantity: 1, rate: 10000, taxRate: 18 }] });
  const invoice = { invoiceNumber: "INV-AUDIT", gstSnapshot: { ...gstSnapshot, supplierStateCode: "27", cgst: 0, sgst: 0, igst: 1800 } };
  const before = JSON.stringify(invoice); const audit = auditGstSnapshot(invoice);
  assert.equal(audit.expectedCgst, 900); assert.equal(audit.expectedSgst, 900); assert.equal(audit.expectedIgst, 0); assert.match(audit.reason, /contradicts GSTIN/); assert.equal(JSON.stringify(invoice), before);
  assert.match(auditGstSnapshot({ invoiceNumber: "INV-LEGACY" }).reason, /Indeterminate/);
});
test("PDF uses historical GSTIN, POS and persisted nonzero components", () => {
  const { buildInvoicePdfDefinition } = require("../src/utils/pdfInvoice");
  const { totals, gstSnapshot } = buildTaxDocument({ business, counterparty: { stateCode: "23" }, lineItems: [{ productName: "Service", quantity: 1, rate: 10000, taxRate: 18 }] });
  const definition = buildInvoicePdfDefinition({ business: { name: "Changed business", gstTaxId: "27ABCDE1234F1Z5", bankDetails: {} }, invoice: { ...totals, gstSnapshot, invoiceNumber: "INV-PDF", invoiceDate: "2026-09-17", dueDate: "2026-09-17", customerDetails: { name: "Client" } } });
  const output = JSON.stringify(definition);
  assert.match(output, /23CGZPB7175E1Z5/); assert.match(output, /Place of Supply/); assert.match(output, /CGST/); assert.match(output, /SGST/); assert.doesNotMatch(output, /"IGST"/); assert.match(output, /11800.00/);
});
test("settings validate payment details without treating account numbers as arithmetic", () => {
  const { businessSetupValidator } = require("../src/validators/auth.validation");
  assert.equal(businessSetupValidator({ name: "Business", email: " nemnidhi@123.com ", bankIfscCode: "HDFC0001234", bankUpiId: "client@bank", bankAccountNumber: "0001234567", taxRate: 18 }).valid, true);
  const bad = businessSetupValidator({ name: "Business", bankIfscCode: "AHD45678", bankUpiId: "invalid", taxRate: Infinity, taxMode: "inclusive" });
  for (const field of ["bankIfscCode", "bankUpiId", "taxRate", "taxMode"]) assert.ok(bad.errors[field]);
});
