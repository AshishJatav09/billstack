require("../config/load-env")();

const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const CustomerLedger = require("../models/CustomerLedger");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const PaymentAllocation = require("../models/PaymentAllocation");
const PaymentAllocationReversal = require("../models/PaymentAllocationReversal");
const { allocationTotal, applyFinancialRead } = require("../services/financial-read.service");

const redactId = (value) => (value ? String(value) : "");
const money = (value) => Number(value || 0).toFixed(2);

const main = async () => {
  const invoiceNumber = process.argv[2] || "INV-2026-0001";
  await mongoose.connect(process.env.MONGO_URI);
  const invoice = await Invoice.findOne({ invoiceNumber }).populate("customerId", "name email phone").lean();
  if (!invoice) {
    console.log(JSON.stringify({ invoiceNumber, found: false }, null, 2));
    await mongoose.disconnect();
    return;
  }

  const businessId = invoice.businessId;
  const customerId = invoice.customerId?._id || invoice.customerId;
  const [payments, allocations, reversals, ledgerRows, customer] = await Promise.all([
    Payment.find({ businessId, customerId }).sort("createdAt").lean(),
    PaymentAllocation.find({ businessId, invoiceId: invoice._id }).sort("createdAt").lean(),
    PaymentAllocationReversal.find({ businessId }).sort("createdAt").lean(),
    CustomerLedger.find({ businessId, customerId }).sort("createdAt").lean(),
    Customer.findOne({ _id: customerId, businessId }).lean(),
  ]);
  const derived = await applyFinancialRead({ businessId, sourceType: "INVOICE", document: invoice });
  const netAllocated = await allocationTotal({ businessId, sourceType: "INVOICE", sourceDocumentId: invoice._id });
  const duplicateLedgerKeys = Object.entries(
    ledgerRows.reduce((map, row) => {
      const key = row.sourceKey || `payment:${row.paymentId || ""}:allocation:${row.allocationId || ""}`;
      map[key] = (map[key] || 0) + 1;
      return map;
    }, {})
  ).filter(([, count]) => count > 1);

  console.log(JSON.stringify({
    invoice: {
      id: redactId(invoice._id),
      invoiceNumber: invoice.invoiceNumber,
      customer: customer?.name || invoice.customerId?.name || "",
      grandTotal: money(invoice.grandTotal),
      storedAmountPaid: money(invoice.amountPaid),
      storedBalanceDue: money(invoice.balanceDue),
      storedPaymentStatus: invoice.paymentStatus,
      derivedAmountPaid: money(derived.amountPaid),
      derivedBalanceDue: money(derived.balanceDue),
      derivedPaymentStatus: derived.paymentStatus,
      netAllocated: money(netAllocated),
    },
    payments: payments.map((row) => ({
      id: redactId(row._id),
      amount: money(row.amount),
      method: row.paymentMethod,
      referenceNumber: row.referenceNumber,
      idempotencyKey: row.idempotencyKey ? "<present>" : "",
      status: row.status,
      createdAt: row.createdAt,
    })),
    allocations: allocations.map((row) => ({
      id: redactId(row._id),
      paymentId: redactId(row.paymentId),
      allocatedAmount: money(row.allocatedAmount),
      createdAt: row.createdAt,
    })),
    reversals: reversals.filter((row) => allocations.some((allocation) => String(allocation._id) === String(row.allocationId))).map((row) => ({
      id: redactId(row._id),
      allocationId: redactId(row.allocationId),
      amount: money(row.amount),
      createdAt: row.createdAt,
    })),
    ledgerRows: ledgerRows.map((row) => ({
      id: redactId(row._id),
      eventType: row.eventType,
      direction: row.direction,
      amount: money(row.amount),
      invoiceId: redactId(row.invoiceId),
      paymentId: redactId(row.paymentId),
      allocationId: redactId(row.allocationId),
      sourceKey: row.sourceKey,
      referenceNumber: row.referenceNumber,
      createdAt: row.createdAt,
    })),
    duplicateLedgerKeys,
    suspectedIssues: {
      paymentLedgerRowsWithoutAllocation: ledgerRows.filter((row) => row.eventType === "PAYMENT" && row.paymentId && !row.allocationId).length,
      allocationLedgerRows: ledgerRows.filter((row) => row.eventType === "PAYMENT" && row.allocationId).length,
      derivedDisagreesWithStored: Number(derived.balanceDue || 0) !== Number(invoice.balanceDue || 0) || derived.paymentStatus !== invoice.paymentStatus,
    },
  }, null, 2));
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
