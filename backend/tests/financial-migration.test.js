const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyLegacyDocument } = require("../src/services/financial-migration.service");
const FinancialMigrationProvenance = require("../src/models/FinancialMigrationProvenance");
const SupplierLedger = require("../src/models/SupplierLedger");
const InvoiceLedgerEvent = require("../src/models/InvoiceLedgerEvent");
const PaymentAllocationReversal = require("../src/models/PaymentAllocationReversal");
const { allocationQuery, deriveFinancialState, summarizeInvoiceFinancials, documentUpdateDecision, hasFinancialChanges, legacyPaymentWriteDecision } = require("../src/services/financial-read.service");

test("zero-payment legacy documents migrate without a synthetic payment", () => {
  const result = classifyLegacyDocument({ sourceType: "INVOICE", document: { amountPaid: 0, grandTotal: 100, status: "issued" } });
  assert.equal(result.state, "MIGRATED"); assert.equal(result.allocated, 0);
});
test("partial and full legacy payments are held for review when historical metadata is absent", () => {
  const partial = classifyLegacyDocument({ sourceType: "INVOICE", document: { amountPaid: 20, grandTotal: 100, status: "issued" } });
  const full = classifyLegacyDocument({ sourceType: "PURCHASE", document: { paidAmount: 100, totalAmount: 100 } });
  assert.equal(partial.code, "MISSING_PAYMENT_METADATA"); assert.equal(full.code, "MISSING_PAYMENT_METADATA");
});
test("overpayments and cancelled invoices become auditable exceptions", () => {
  assert.equal(classifyLegacyDocument({ sourceType: "INVOICE", document: { amountPaid: 101, grandTotal: 100, status: "issued" } }).code, "OVERPAID_LEGACY_DOCUMENT");
  assert.equal(classifyLegacyDocument({ sourceType: "INVOICE", document: { amountPaid: 10, grandTotal: 100, status: "cancelled" } }).code, "CANCELLED_DOCUMENT");
});
test("migration provenance has a tenant-scoped unique source/version key", () => {
  const indexes = FinancialMigrationProvenance.schema.indexes();
  const uniqueIndex = indexes.find(([fields, options]) => fields.businessId === 1 && fields.sourceType === 1 && fields.sourceDocumentId === 1 && fields.migrationType === 1 && fields.migrationVersion === 1 && options.unique);
  assert.ok(uniqueIndex);
});
test("legacy-only invoice preserves legacy payment fields", () => {
  const state = deriveFinancialState({ sourceType: "INVOICE", document: { amountPaid: 20, balanceDue: 80, grandTotal: 100, paymentStatus: "partial" }, migrated: false });
  assert.equal(state.source, "legacy"); assert.equal(state.paidAmount, 20); assert.equal(state.outstandingAmount, 80);
});
test("allocation-backed invoice derives partial and paid states and exposes mismatches", () => {
  const partial = deriveFinancialState({ sourceType: "INVOICE", document: { amountPaid: 20, balanceDue: 80, grandTotal: 100, paymentStatus: "partial" }, migrated: true, allocatedAmount: 40 });
  const paid = deriveFinancialState({ sourceType: "INVOICE", document: { amountPaid: 100, balanceDue: 0, grandTotal: 100, paymentStatus: "paid" }, migrated: true, allocatedAmount: 100 });
  assert.equal(partial.paymentStatus, "partial"); assert.equal(partial.outstandingAmount, 60); assert.equal(partial.reconciliation.status, "MISMATCH");
  assert.equal(paid.paymentStatus, "paid"); assert.equal(paid.reconciliation.status, "MATCHED");
});
test("derived payment state caps over-allocation and exposes reconciliation mismatch", () => {
  const state = deriveFinancialState({ sourceType: "INVOICE", document: { amountPaid: 100, balanceDue: 0, grandTotal: 100, paymentStatus: "paid" }, migrated: true, allocatedAmount: 125 });
  assert.equal(state.paidAmount, 100); assert.equal(state.outstandingAmount, 0); assert.equal(state.paymentStatus, "paid");
  assert.equal(state.reconciliation.status, "MISMATCH"); assert.equal(state.reconciliation.overAllocated, true);
});
test("cancelled invoices retain existing cancellation behaviour", () => {
  const state = deriveFinancialState({ sourceType: "INVOICE", document: { status: "cancelled", amountPaid: 30, balanceDue: 0, paymentStatus: "cancelled", grandTotal: 100 }, migrated: true, allocatedAmount: 30 });
  assert.equal(state.paymentStatus, "cancelled"); assert.equal(state.source, "legacy");
});
test("purchase reads support legacy and allocation-backed payment states", () => {
  const legacy = deriveFinancialState({ sourceType: "PURCHASE", document: { paidAmount: 0, totalAmount: 100, paymentStatus: "unpaid" }, migrated: false });
  const derived = deriveFinancialState({ sourceType: "PURCHASE", document: { paidAmount: 20, totalAmount: 100, paymentStatus: "partial" }, migrated: true, allocatedAmount: 100 });
  assert.equal(legacy.outstandingAmount, 100); assert.equal(derived.paymentStatus, "paid"); assert.equal(derived.outstandingAmount, 0);
});
test("allocation reads always include the authenticated tenant scope", () => {
  const invoiceFilter = allocationQuery({ businessId: "tenant-a", sourceType: "INVOICE", sourceDocumentId: "invoice-a" });
  const purchaseFilter = allocationQuery({ businessId: "tenant-b", sourceType: "PURCHASE", sourceDocumentId: "purchase-b" });
  assert.deepEqual(invoiceFilter, { businessId: "tenant-a", invoiceId: "invoice-a" });
  assert.deepEqual(purchaseFilter, { businessId: "tenant-b", purchaseId: "purchase-b" });
});
test("reporting summary uses derived allocation values while sales stays invoice-total based", () => {
  const summary = summarizeInvoiceFinancials([
    { status: "issued", grandTotal: 100, amountPaid: 60, balanceDue: 40, dueDate: new Date(Date.now() - 86400000), financialRead: { reconciliation: { status: "MISMATCH" } } },
    { status: "cancelled", grandTotal: 50, amountPaid: 50, balanceDue: 0, dueDate: new Date(Date.now() - 86400000) },
  ]);
  assert.equal(summary.totalSales, 100); assert.equal(summary.paidAmount, 60); assert.equal(summary.unpaidAmount, 40); assert.equal(summary.overdueInvoices, 1); assert.equal(summary.mismatchCount, 1);
});
test("documents without allocations preserve the existing update path", () => {
  assert.deepEqual(documentUpdateDecision({ sourceType: "INVOICE", allocationsExist: false, body: { lineItems: [] } }), { allowed: true, reason: "NO_ALLOCATIONS" });
});
test("allocated invoice and purchase reject financial changes", () => {
  assert.equal(documentUpdateDecision({ sourceType: "INVOICE", allocationsExist: true, body: { lineItems: [] } }).allowed, false);
  assert.equal(documentUpdateDecision({ sourceType: "PURCHASE", allocationsExist: true, body: { totalAmount: 99 } }).allowed, false);
});
test("allocated documents allow only safe notes/terms edits", () => {
  assert.equal(hasFinancialChanges({ sourceType: "INVOICE", body: { notes: "Updated" } }), false);
  assert.equal(documentUpdateDecision({ sourceType: "INVOICE", allocationsExist: true, body: { notes: "Updated", termsAndConditions: "Net 30" } }).allowed, true);
});
test("tenant-scoped allocation decisions cannot be influenced by another tenant", () => {
  assert.deepEqual(allocationQuery({ businessId: "tenant-a", sourceType: "INVOICE", sourceDocumentId: "same-id" }), { businessId: "tenant-a", invoiceId: "same-id" });
  assert.notDeepEqual(allocationQuery({ businessId: "tenant-b", sourceType: "INVOICE", sourceDocumentId: "same-id" }), allocationQuery({ businessId: "tenant-a", sourceType: "INVOICE", sourceDocumentId: "same-id" }));
});
test("supplier and invoice ledger foundations are append-only and tenant indexed", () => {
  assert.ok(SupplierLedger.schema.indexes().some(([fields]) => fields.businessId === 1 && fields.supplierId === 1));
  assert.ok(InvoiceLedgerEvent.schema.indexes().some(([fields, options]) => fields.businessId === 1 && fields.invoiceId === 1 && options.unique));
  assert.ok(PaymentAllocationReversal.schema.indexes().some(([fields, options]) => fields.businessId === 1 && fields.allocationId === 1 && options.unique));
});
test("legacy payment writes remain compatible only for non-migrated unallocated documents", () => {
  assert.equal(legacyPaymentWriteDecision({ sourceType: "INVOICE", migrated: false, allocationsExist: false, body: { amountPaid: 10 } }).allowed, true);
  assert.equal(legacyPaymentWriteDecision({ sourceType: "INVOICE", migrated: true, allocationsExist: false, body: { amountPaid: 10 } }).allowed, false);
  assert.equal(legacyPaymentWriteDecision({ sourceType: "INVOICE", migrated: false, allocationsExist: true, body: { amountPaid: 10 } }).allowed, false);
  assert.equal(legacyPaymentWriteDecision({ sourceType: "INVOICE", migrated: true, allocationsExist: true, body: { paymentStatus: "paid" } }).reason, "USE_PAYMENT_WORKFLOW");
  assert.equal(legacyPaymentWriteDecision({ sourceType: "PURCHASE", migrated: true, allocationsExist: false, body: { paidAmount: 10 } }).allowed, false);
  assert.equal(legacyPaymentWriteDecision({ sourceType: "INVOICE", migrated: true, allocationsExist: true, body: { notes: "safe" } }).allowed, true);
});
