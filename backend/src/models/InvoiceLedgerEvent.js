const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true, immutable: true },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true, index: true, immutable: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true, immutable: true },
  eventType: { type: String, enum: ["INVOICE", "PAYMENT", "ADJUSTMENT", "REVERSAL"], required: true, immutable: true },
  amount: { type: Number, required: true, min: 0, immutable: true },
  direction: { type: String, enum: ["DEBIT", "CREDIT"], required: true, immutable: true },
  source: { type: String, enum: ["LEGACY", "ALLOCATIONS", "MIGRATION"], required: true, immutable: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, immutable: true },
}, { timestamps: true });
schema.index({ businessId: 1, invoiceId: 1, eventType: 1, source: 1 }, { unique: true });
schema.pre(["findOneAndUpdate", "updateOne", "updateMany", "findOneAndDelete", "deleteOne", "deleteMany"], () => { throw new Error("Invoice ledger events are append-only."); });
module.exports = mongoose.model("InvoiceLedgerEvent", schema);
