const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const Purchase = require("../models/Purchase");
const FinancialMigrationProvenance = require("../models/FinancialMigrationProvenance");
const { createCustomerLedgerEntryOnce, createSupplierLedgerEntryOnce } = require("./ledger.service");
const { fromMinorUnits, toMinorUnits } = require("../utils/money");

const MIGRATION_TYPE = "LEGACY_PAYMENT_BACKFILL";
const MIGRATION_VERSION = "v1";

const classifyLegacyDocument = ({ sourceType, document }) => {
  const paidField = sourceType === "INVOICE" ? "amountPaid" : "paidAmount";
  const totalField = sourceType === "INVOICE" ? "grandTotal" : "totalAmount";
  const paid = toMinorUnits(document[paidField] || 0, "Legacy paid amount", { allowZero: true });
  const total = toMinorUnits(document[totalField] || 0, "Legacy document total", { allowZero: true });
  if (sourceType === "INVOICE" && document.status === "cancelled") return { state: "EXCEPTION", code: "CANCELLED_DOCUMENT", message: "Cancelled invoices require an explicit reversal policy.", paid };
  if (paid > total) return { state: "EXCEPTION", code: "OVERPAID_LEGACY_DOCUMENT", message: "Legacy paid amount exceeds document total.", paid };
  if (paid === 0) return { state: "MIGRATED", paid, allocated: 0, message: "No legacy payment exists; no synthetic payment created." };
  return { state: "EXCEPTION", code: "MISSING_PAYMENT_METADATA", message: "Legacy aggregate payment amount has no payment date, method, reference, or per-payment history; no synthetic payment was created.", paid };
};

const provenanceKey = (businessId, sourceType, sourceDocumentId) => ({ businessId, sourceType, sourceDocumentId, migrationType: MIGRATION_TYPE, migrationVersion: MIGRATION_VERSION });
const migrateDocument = async ({ businessId, sourceType, document, dryRun = false }) => {
  const key = provenanceKey(businessId, sourceType, document._id);
  const existing = await FinancialMigrationProvenance.findOne(key);
  if (existing) return { sourceType, sourceDocumentId: document._id.toString(), outcome: "SKIPPED", state: existing.state, reason: "Already processed for this migration version." };
  const result = classifyLegacyDocument({ sourceType, document });
  const report = { sourceType, sourceDocumentId: document._id.toString(), outcome: dryRun ? "DRY_RUN" : "PROCESSED", state: result.state, legacyPaidAmount: fromMinorUnits(result.paid), migratedAllocatedAmount: fromMinorUnits(result.allocated || 0), exceptionCode: result.code || "", message: result.message };
  if (dryRun) return report;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const duplicate = await FinancialMigrationProvenance.findOne(key).session(session);
      if (duplicate) { report.outcome = "SKIPPED"; report.state = duplicate.state; return; }
      await FinancialMigrationProvenance.create([{ ...key, state: result.state, legacyPaidAmount: fromMinorUnits(result.paid), migratedAllocatedAmount: fromMinorUnits(result.allocated || 0), exceptionCode: result.code || "", exceptionMessage: result.message, completedAt: new Date() }], { session });
      if (result.state === "MIGRATED") {
        if (sourceType === "INVOICE" && document.customerId) await createCustomerLedgerEntryOnce({ businessId, customerId: document.customerId, eventType: "INVOICE", amount: document.grandTotal || 0, direction: "DEBIT", invoiceId: document._id, sourceKey: `INVOICE:${document._id}:DEBIT`, createdBy: null }, { session });
        if (sourceType === "PURCHASE" && document.supplierId) await createSupplierLedgerEntryOnce({ businessId, supplierId: document.supplierId, eventType: "PURCHASE", amount: document.totalAmount || 0, direction: "DEBIT", purchaseId: document._id, sourceKey: `PURCHASE:${document._id}:PAYABLE`, createdBy: null }, { session });
      }
    });
    return report;
  } finally { session.endSession(); }
};

const migrateBusiness = async ({ businessId, dryRun = false }) => {
  const [invoices, purchases] = await Promise.all([Invoice.find({ businessId }).select("amountPaid grandTotal status customerId"), Purchase.find({ businessId }).select("paidAmount totalAmount supplierId")]);
  const results = [];
  for (const invoice of invoices) results.push(await migrateDocument({ businessId, sourceType: "INVOICE", document: invoice, dryRun }));
  for (const purchase of purchases) results.push(await migrateDocument({ businessId, sourceType: "PURCHASE", document: purchase, dryRun }));
  return { businessId: businessId.toString(), dryRun, migrationType: MIGRATION_TYPE, migrationVersion: MIGRATION_VERSION, summary: results.reduce((summary, item) => ({ ...summary, [item.state]: (summary[item.state] || 0) + 1 }), { MIGRATED: 0, EXCEPTION: 0, SKIPPED: 0 }), results };
};

const reconcileBusiness = async ({ businessId }) => {
  const { allocationTotal } = require("./financial-read.service");
  const rows = await FinancialMigrationProvenance.find({ businessId, migrationType: MIGRATION_TYPE, migrationVersion: MIGRATION_VERSION });
  const results = await Promise.all(rows.map(async (row) => {
    const liveAllocated = row.state === "MIGRATED" ? await allocationTotal({ businessId, sourceType: row.sourceType, sourceDocumentId: row.sourceDocumentId }) : 0;
    return { sourceType: row.sourceType, sourceDocumentId: row.sourceDocumentId.toString(), state: row.state, legacyPaidAmount: row.legacyPaidAmount, migratedAllocatedAmount: fromMinorUnits(toMinorUnits(liveAllocated, "Live allocated amount", { allowZero: true })), difference: fromMinorUnits(toMinorUnits(row.legacyPaidAmount, "Legacy paid amount", { allowZero: true }) - toMinorUnits(liveAllocated, "Live allocated amount", { allowZero: true })), exceptionCode: row.exceptionCode };
  }));
  return { businessId: businessId.toString(), matched: results.filter((row) => row.difference === 0 && row.state === "MIGRATED").length, exceptions: results.filter((row) => row.state === "EXCEPTION").length, mismatches: results.filter((row) => row.difference !== 0).length, results };
};
module.exports = { MIGRATION_TYPE, MIGRATION_VERSION, classifyLegacyDocument, migrateBusiness, migrateDocument, reconcileBusiness };
