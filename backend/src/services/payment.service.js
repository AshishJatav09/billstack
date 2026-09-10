const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const CustomerLedger = require("../models/CustomerLedger");
const Invoice = require("../models/Invoice");
const Payment = require("../models/Payment");
const PaymentAllocation = require("../models/PaymentAllocation");
const Purchase = require("../models/Purchase");
const Supplier = require("../models/Supplier");
const SupplierLedger = require("../models/SupplierLedger");
const PaymentAllocationReversal = require("../models/PaymentAllocationReversal");
const AppError = require("../utils/appError");
const { fromMinorUnits, toMinorUnits } = require("../utils/money");
const { log } = require("../utils/logger");
const { dispatchPaymentRecordedAutomation } = require("./communication.service");
const { createCustomerLedgerEntryOnce, createSupplierLedgerEntryOnce } = require("./ledger.service");

const sumAmounts = (rows) => rows.reduce((sum, row) => sum + toMinorUnits(row.allocatedAmount), 0);
const netDocumentAllocations = async ({ businessId, documentKey, documentId, session }) => {
  const allocations = await PaymentAllocation.find({ businessId, [documentKey]: documentId }).session(session).select("_id allocatedAmount");
  const reversals = await PaymentAllocationReversal.find({ businessId, allocationId: { $in: allocations.map((row) => row._id) } }).session(session).select("allocationId amount");
  const reversedByAllocation = reversals.reduce((map, row) => {
    const key = row.allocationId.toString();
    map.set(key, (map.get(key) || 0) + toMinorUnits(row.amount, "Reversal amount", { allowZero: true }));
    return map;
  }, new Map());
  return allocations.reduce((sum, row) => Math.max(toMinorUnits(row.allocatedAmount, "Allocated amount", { allowZero: true }) - (reversedByAllocation.get(row._id.toString()) || 0), 0) + sum, 0);
};
const validateAllocationCounterparty = ({ sourceType, document, payment }) => {
  const expected = sourceType === "INVOICE" ? document.customerId : document.supplierId;
  const actual = sourceType === "INVOICE" ? payment.customerId : payment.supplierId;
  if (!actual || !expected || actual.toString() !== expected.toString()) throw new AppError("Payment counterparty does not match document", 400);
  return true;
};
const validateReversalRequest = ({ allocationAmount, alreadyReversed, requestedAmount }) => {
  if (alreadyReversed) throw new AppError("This allocation has already been reversed", 409);
  const requested = fromMinorUnits(toMinorUnits(requestedAmount || allocationAmount, "Reversal amount"));
  if (toMinorUnits(requested) > toMinorUnits(allocationAmount)) throw new AppError("Reversal exceeds allocated amount", 400);
  return requested;
};
const paymentAllocations = (paymentId, session) => PaymentAllocation.find({ paymentId }).session(session).select("allocatedAmount");

const createPayment = async ({ businessId, userId, payload }) => {
  const direction = String(payload.direction || "").toUpperCase();
  if (!["RECEIVED", "PAID"].includes(direction)) throw new AppError("Payment direction must be RECEIVED or PAID", 400);
  if (payload.customerId && payload.supplierId) throw new AppError("A payment cannot reference both a customer and supplier", 400);
  if (direction === "RECEIVED" && !payload.customerId) throw new AppError("A received payment requires a customer", 400);
  if (direction === "PAID" && !payload.supplierId) throw new AppError("A paid payment requires a supplier", 400);
  const amount = fromMinorUnits(toMinorUnits(payload.amount));
  const session = await mongoose.startSession();
  try {
    let payment;
    await session.withTransaction(async () => {
      if (payload.customerId && !(await Customer.findOne({ _id: payload.customerId, businessId }).session(session))) throw new AppError("Customer not found", 404);
      if (payload.supplierId && !(await Supplier.findOne({ _id: payload.supplierId, businessId }).session(session))) throw new AppError("Supplier not found", 404);
      [payment] = await Payment.create([{ businessId, direction, amount, currency: payload.currency || "INR", paymentDate: payload.paymentDate ? new Date(payload.paymentDate) : new Date(), paymentMethod: payload.paymentMethod || "OTHER", referenceNumber: payload.referenceNumber || "", customerId: payload.customerId || null, supplierId: payload.supplierId || null, notes: payload.notes || "", createdBy: userId }], { session });
      if (payment.customerId) await CustomerLedger.create([{ businessId, customerId: payment.customerId, eventType: "PAYMENT", amount, direction: "CREDIT", paymentId: payment._id, referenceNumber: payment.referenceNumber, notes: payment.notes, createdBy: userId }], { session });
      if (payment.supplierId) await SupplierLedger.create([{ businessId, supplierId: payment.supplierId, eventType: "PAYMENT", amount, direction: "CREDIT", paymentId: payment._id, referenceNumber: payment.referenceNumber, notes: payment.notes, createdBy: userId }], { session });
    });
    return payment;
  } finally { session.endSession(); }
};

const allocatePayment = async ({ businessId, userId, paymentId, payload }) => {
  const invoiceId = payload.invoiceId || null; const purchaseId = payload.purchaseId || null;
  if (Boolean(invoiceId) === Boolean(purchaseId)) throw new AppError("Allocate to exactly one invoice or purchase", 400);
  const amount = fromMinorUnits(toMinorUnits(payload.allocatedAmount, "Allocated amount"));
  const session = await mongoose.startSession();
  try {
    let allocation;
    await session.withTransaction(async () => {
      const payment = await Payment.findOne({ _id: paymentId, businessId, status: "POSTED" }).session(session);
      if (!payment) throw new AppError("Payment not found", 404);
      const used = sumAmounts(await paymentAllocations(payment._id, session));
      if (toMinorUnits(payment.amount) - used < toMinorUnits(amount)) throw new AppError("Allocation exceeds available payment amount", 400);
      if (invoiceId) {
        if (payment.direction !== "RECEIVED") throw new AppError("Only received payments can be allocated to invoices", 400);
        const invoice = await Invoice.findOne({ _id: invoiceId, businessId, status: { $ne: "cancelled" } }).session(session);
        if (!invoice) throw new AppError("Invoice not found", 404);
        if (!payment.customerId || payment.customerId.toString() !== invoice.customerId.toString()) throw new AppError("Payment customer does not match invoice customer", 400);
        if (await PaymentAllocation.findOne({ paymentId: payment._id, invoiceId: invoice._id }).session(session)) throw new AppError("This payment is already allocated to the invoice", 409);
        const allocated = await netDocumentAllocations({ businessId, documentKey: "invoiceId", documentId: invoice._id, session });
        const outstanding = toMinorUnits(invoice.grandTotal, "Invoice total amount", { allowZero: true }) - allocated;
        if (toMinorUnits(amount) > outstanding) throw new AppError("Allocation exceeds invoice outstanding amount", 400);
        [allocation] = await PaymentAllocation.create([{ paymentId: payment._id, businessId, invoiceId: invoice._id, allocatedAmount: amount, createdBy: userId }], { session });
        await createCustomerLedgerEntryOnce({ businessId, customerId: invoice.customerId, eventType: "PAYMENT", amount, direction: "CREDIT", invoiceId: invoice._id, paymentId: payment._id, allocationId: allocation._id, referenceNumber: payment.referenceNumber, notes: "Payment allocation", createdBy: userId }, { session });
      } else {
        if (payment.direction !== "PAID") throw new AppError("Only paid payments can be allocated to purchases", 400);
        const purchase = await Purchase.findOne({ _id: purchaseId, businessId }).session(session);
        if (!purchase) throw new AppError("Purchase not found", 404);
        if (!payment.supplierId || payment.supplierId.toString() !== purchase.supplierId.toString()) throw new AppError("Payment supplier does not match purchase supplier", 400);
        if (await PaymentAllocation.findOne({ paymentId: payment._id, purchaseId: purchase._id }).session(session)) throw new AppError("This payment is already allocated to the purchase", 409);
        const allocated = await netDocumentAllocations({ businessId, documentKey: "purchaseId", documentId: purchase._id, session });
        const outstanding = toMinorUnits(purchase.totalAmount, "Purchase total amount", { allowZero: true }) - allocated;
        if (toMinorUnits(amount) > outstanding) throw new AppError("Allocation exceeds purchase outstanding amount", 400);
        [allocation] = await PaymentAllocation.create([{ paymentId: payment._id, businessId, purchaseId: purchase._id, allocatedAmount: amount, createdBy: userId }], { session });
        await createSupplierLedgerEntryOnce({ businessId, supplierId: purchase.supplierId, eventType: "PAYMENT", amount, direction: "CREDIT", purchaseId: purchase._id, paymentId: payment._id, allocationId: allocation._id, referenceNumber: payment.referenceNumber, notes: "Payment allocation", createdBy: userId }, { session });
      }
    });
    if (allocation?.invoiceId) {
      await dispatchPaymentRecordedAutomation({ businessId, allocationId: allocation._id, createdBy: userId })
        .catch((error) => log("warn", "Payment recorded automation failed", { allocationId: allocation._id.toString(), error: error.message }));
    }
    return allocation;
  } finally { session.endSession(); }
};

const listPayments = ({ businessId, query }) => Payment.find({ businessId }).sort("-paymentDate -createdAt").limit(Math.min(Number(query.limit) || 50, 100)).populate("customerId", "name").populate("supplierId", "supplierName");
const getPayment = ({ businessId, paymentId }) => Payment.findOne({ _id: paymentId, businessId }).populate("customerId", "name").populate("supplierId", "supplierName");
const listCustomerLedger = ({ businessId, customerId }) => CustomerLedger.find({ businessId, customerId }).sort("-createdAt").populate("invoiceId", "invoiceNumber").populate("paymentId", "referenceNumber amount");
const listSupplierLedger = ({ businessId, supplierId }) => SupplierLedger.find({ businessId, supplierId }).sort("-createdAt").populate("purchaseId", "purchaseNumber").populate("paymentId", "referenceNumber amount");
const listAllocations = async ({ businessId, sourceType, sourceDocumentId }) => {
  const isInvoice = sourceType === "INVOICE";
  const document = isInvoice
    ? await Invoice.findOne({ _id: sourceDocumentId, businessId }).select("customerId")
    : await Purchase.findOne({ _id: sourceDocumentId, businessId }).select("supplierId");
  if (!document) throw new AppError(`${isInvoice ? "Invoice" : "Purchase"} not found`, 404);
  const rows = await PaymentAllocation.find({ businessId, [isInvoice ? "invoiceId" : "purchaseId"]: sourceDocumentId }).sort("-createdAt").populate("paymentId", "amount paymentDate paymentMethod referenceNumber status direction customerId supplierId");
  const reversals = await PaymentAllocationReversal.find({ businessId, allocationId: { $in: rows.map((row) => row._id) } }).select("allocationId");
  const reversed = new Set(reversals.map((row) => row.allocationId.toString()));
  return rows.filter((row) => {
    if (!row.paymentId || row.paymentId.status !== "POSTED" || reversed.has(row._id.toString())) return false;
    validateAllocationCounterparty({ sourceType, document, payment: row.paymentId });
    return true;
  }).map((row) => ({
    allocationId: row._id,
    paymentId: row.paymentId._id,
    allocatedAmount: row.allocatedAmount,
    createdAt: row.createdAt,
    payment: { amount: row.paymentId.amount, paymentDate: row.paymentId.paymentDate, paymentMethod: row.paymentId.paymentMethod, referenceNumber: row.paymentId.referenceNumber, direction: row.paymentId.direction, status: row.paymentId.status },
  }));
};
const reverseAllocation = async ({ businessId, userId, allocationId, amount, reason }) => {
  const session = await mongoose.startSession();
  try { let reversal; await session.withTransaction(async () => {
    const allocation = await PaymentAllocation.findOne({ _id: allocationId, businessId }).session(session);
    if (!allocation) throw new AppError("Payment allocation not found", 404);
    const payment = await Payment.findOne({ _id: allocation.paymentId, businessId, status: "POSTED" }).session(session);
    if (!payment) throw new AppError("Posted payment not found", 404);
    const prior = await PaymentAllocationReversal.findOne({ allocationId, businessId }).session(session);
    const requested = validateReversalRequest({ allocationAmount: allocation.allocatedAmount, alreadyReversed: Boolean(prior), requestedAmount: amount });
    [reversal] = await PaymentAllocationReversal.create([{ businessId, allocationId, amount: requested, reason, createdBy: userId }], { session });
    if (allocation.invoiceId) {
      const invoice = await Invoice.findOne({ _id: allocation.invoiceId, businessId }).select("customerId").session(session);
      if (invoice) await createCustomerLedgerEntryOnce({ businessId, customerId: invoice.customerId, eventType: "REVERSAL", amount: requested, direction: "DEBIT", invoiceId: invoice._id, paymentId: allocation.paymentId, reversalId: reversal._id, notes: reason, createdBy: userId }, { session });
    } else if (allocation.purchaseId) {
      const purchase = await Purchase.findOne({ _id: allocation.purchaseId, businessId }).select("supplierId").session(session);
      if (purchase) await createSupplierLedgerEntryOnce({ businessId, supplierId: purchase.supplierId, eventType: "REVERSAL", amount: requested, direction: "DEBIT", purchaseId: purchase._id, paymentId: allocation.paymentId, reversalId: reversal._id, notes: reason, createdBy: userId }, { session });
    }
  }); return reversal; } finally { session.endSession(); }
};
module.exports = { allocatePayment, createPayment, getPayment, listAllocations, listCustomerLedger, listPayments, listSupplierLedger, reverseAllocation, validateAllocationCounterparty, validateReversalRequest };
