const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true, immutable: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true, immutable: true },
  eventType: { type: String, enum: ["PURCHASE", "PAYMENT", "CREDIT", "REFUND", "ADJUSTMENT", "REVERSAL"], required: true, immutable: true },
  amount: { type: Number, required: true, min: 0.01, immutable: true },
  direction: { type: String, enum: ["DEBIT", "CREDIT"], required: true, immutable: true },
  purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", default: null, immutable: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null, immutable: true },
  allocationId: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentAllocation", default: null, immutable: true },
  reversalId: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentAllocationReversal", default: null, immutable: true },
  referenceNumber: { type: String, trim: true, default: "", immutable: true },
  notes: { type: String, trim: true, default: "", immutable: true },
  sourceKey: { type: String, trim: true, default: "", immutable: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, immutable: true },
}, { timestamps: true });
schema.index({ businessId: 1, supplierId: 1, createdAt: -1 });
schema.index({ businessId: 1, paymentId: 1 }, { unique: true, partialFilterExpression: { paymentId: { $type: "objectId" } } });
schema.index({ businessId: 1, allocationId: 1 }, { unique: true, partialFilterExpression: { allocationId: { $type: "objectId" } } });
schema.index({ businessId: 1, reversalId: 1 }, { unique: true, partialFilterExpression: { reversalId: { $type: "objectId" } } });
schema.index({ businessId: 1, sourceKey: 1 }, { unique: true, partialFilterExpression: { sourceKey: { $type: "string", $ne: "" } } });
schema.pre(["findOneAndUpdate", "updateOne", "updateMany", "findOneAndDelete", "deleteOne", "deleteMany"], () => { throw new Error("Supplier ledger entries are append-only."); });
module.exports = mongoose.model("SupplierLedger", schema);
