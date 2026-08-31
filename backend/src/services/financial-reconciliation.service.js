const Invoice = require("../models/Invoice");
const Purchase = require("../models/Purchase");
const FinancialMigrationProvenance = require("../models/FinancialMigrationProvenance");
const PaymentAllocation = require("../models/PaymentAllocation");
const PaymentAllocationReversal = require("../models/PaymentAllocationReversal");
const CustomerLedger = require("../models/CustomerLedger");
const SupplierLedger = require("../models/SupplierLedger");
const { allocationTotal } = require("./financial-read.service");
const { MIGRATION_TYPE, MIGRATION_VERSION } = require("./financial-migration.service");
const { toMinorUnits, fromMinorUnits } = require("../utils/money");

const reconcileDocument = async ({ businessId, sourceType, document }) => {
  const paidField = sourceType === "INVOICE" ? "amountPaid" : "paidAmount";
  const totalField = sourceType === "INVOICE" ? "grandTotal" : "totalAmount";
  const provenance = await FinancialMigrationProvenance.findOne({ businessId, sourceType, sourceDocumentId: document._id, migrationType: MIGRATION_TYPE, migrationVersion: MIGRATION_VERSION });
  if (!provenance) return { sourceType, documentId: document._id.toString(), status: "EXCEPTION", reason: "MISSING_MIGRATION_PROVENANCE" };
  const allocated = await allocationTotal({ businessId, sourceType, sourceDocumentId: document._id });
  const legacy = Number(document[paidField] || 0);
  const total = Number(document[totalField] || 0);
  const difference = fromMinorUnits(toMinorUnits(legacy, "Legacy amount", { allowZero: true }) - toMinorUnits(allocated, "Allocated amount", { allowZero: true }));
  const overpayment = allocated > total;
  const status = provenance.state === "EXCEPTION" || (document.status === "cancelled" && allocated > 0) ? "EXCEPTION" : difference !== 0 || overpayment ? "MISMATCH" : "OK";
  const allocationFilter = { businessId, [sourceType === "INVOICE" ? "invoiceId" : "purchaseId"]: document._id };
  const allocations = await PaymentAllocation.find(allocationFilter).select("_id allocatedAmount");
  const reversals = await PaymentAllocationReversal.find({ businessId, allocationId: { $in: allocations.map((row) => row._id) } }).select("amount");
  return { sourceType, documentId: document._id.toString(), status, provenanceState: provenance.state, legacyPaidAmount: legacy, allocatedAmount: allocated, documentTotal: total, difference, overpayment, reversalAmount: reversals.reduce((sum, row) => sum + Number(row.amount || 0), 0) };
};

const reconcileBusiness = async ({ businessId }) => {
  const [invoices, purchases] = await Promise.all([Invoice.find({ businessId }).select("_id amountPaid grandTotal status"), Purchase.find({ businessId }).select("_id paidAmount totalAmount")]);
  const results = await Promise.all([...invoices.map((document) => reconcileDocument({ businessId, sourceType: "INVOICE", document })), ...purchases.map((document) => reconcileDocument({ businessId, sourceType: "PURCHASE", document }))]);
  return { businessId: businessId.toString(), status: results.some((row) => row.status === "EXCEPTION") ? "EXCEPTION" : results.some((row) => row.status === "MISMATCH") ? "MISMATCH" : "OK", counts: results.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] || 0) + 1 }), { OK: 0, MISMATCH: 0, EXCEPTION: 0 }), results };
};

module.exports = { reconcileBusiness, reconcileDocument };
