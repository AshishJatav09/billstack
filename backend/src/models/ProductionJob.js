const mongoose = require("mongoose");

const jobItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, trim: true, default: "" },
    quantity: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const productionJobSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    sourceKey: { type: String, trim: true, default: "" },
    jobNumber: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    sourceOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    outputProductId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null, index: true },
    outputQuantity: { type: Number, default: 0, min: 0 },
    inputItems: { type: [jobItemSchema], default: [] },
    stockApplied: { type: Boolean, default: false, index: true },
    stockAppliedAt: { type: Date, default: null },
    status: { type: String, enum: ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"], default: "PLANNED", index: true },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

productionJobSchema.index({ businessId: 1, jobNumber: 1 }, { unique: true });
productionJobSchema.index({ businessId: 1, sourceKey: 1 }, { unique: true, partialFilterExpression: { sourceKey: { $type: "string", $gt: "" } } });
productionJobSchema.index({ businessId: 1, status: 1, dueDate: 1 });
productionJobSchema.index({ businessId: 1, status: 1, stockApplied: 1 });

module.exports = mongoose.model("ProductionJob", productionJobSchema);
