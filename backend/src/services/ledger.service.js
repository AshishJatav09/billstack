const mongoose = require("mongoose");
const InvoiceLedgerEvent = require("../models/InvoiceLedgerEvent");
const SupplierLedger = require("../models/SupplierLedger");
const AppError = require("../utils/appError");
const recordInvoiceEvent = async ({ businessId, invoiceId, customerId, eventType, amount, direction, source, createdBy = null, session }) => {
  const [event] = await InvoiceLedgerEvent.create([{ businessId, invoiceId, customerId, eventType, amount, direction, source, createdBy }], { session });
  return event;
};
const listSupplierLedger = ({ businessId, supplierId }) => SupplierLedger.find({ businessId, supplierId }).sort("-createdAt");
module.exports = { listSupplierLedger, recordInvoiceEvent };
