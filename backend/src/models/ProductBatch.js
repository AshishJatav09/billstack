const mongoose = require("mongoose");

const productBatchSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    sourceKey: { type: String, trim: true, default: "" },
    batchNumber: { type: String, required: true, trim: true },
    manufactureDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null, index: true },
    quantityOnHand: { type: Number, default: 0, min: 0 },
    sourcePurchaseId: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", default: null },
    status: { type: String, enum: ["ACTIVE", "QUARANTINED", "CONSUMED", "EXPIRED"], default: "ACTIVE", index: true },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

productBatchSchema.index({ businessId: 1, productId: 1, batchNumber: 1 }, { unique: true });
productBatchSchema.index({ businessId: 1, sourceKey: 1 }, { unique: true, partialFilterExpression: { sourceKey: { $type: "string", $gt: "" } } });
productBatchSchema.index({ businessId: 1, status: 1, expiryDate: 1 });

module.exports = mongoose.model("ProductBatch", productBatchSchema);
