const mongoose = require("mongoose");

const approvalStepSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
    actedAt: { type: Date, default: null },
    comment: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

const approvalDocumentSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    sourceKey: { type: String, trim: true, default: "" },
    title: { type: String, required: true, trim: true },
    documentType: { type: String, trim: true, default: "GENERAL" },
    sourceType: { type: String, enum: ["ORDER", "INVOICE", "PURCHASE", "PROJECT", "TASK", "GENERAL"], default: "GENERAL" },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    status: { type: String, enum: ["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"], default: "DRAFT", index: true },
    approvers: { type: [approvalStepSchema], default: [] },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

approvalDocumentSchema.index({ businessId: 1, sourceKey: 1 }, { unique: true, partialFilterExpression: { sourceKey: { $type: "string", $gt: "" } } });
approvalDocumentSchema.index({ businessId: 1, status: 1, createdAt: -1 });
approvalDocumentSchema.index({ businessId: 1, sourceType: 1, sourceId: 1 });

module.exports = mongoose.model("ApprovalDocument", approvalDocumentSchema);
