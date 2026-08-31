const mongoose = require("mongoose");

const eInvoiceMetadataSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
      immutable: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      immutable: true,
      index: true,
    },
    irn: {
      type: String,
      trim: true,
      default: "",
      immutable: true,
    },
    acknowledgementNumber: {
      type: String,
      trim: true,
      default: "",
      immutable: true,
    },
    acknowledgementDate: {
      type: Date,
      default: null,
      immutable: true,
    },
    signedInvoiceReference: {
      type: String,
      trim: true,
      default: "",
      immutable: true,
    },
    signedQrData: {
      type: String,
      trim: true,
      default: "",
      immutable: true,
    },
    eInvoiceStatus: {
      type: String,
      enum: ["NOT_REQUIRED", "READY", "SUBMISSION_PENDING", "GENERATED", "FAILED", "CANCELLED"],
      default: "READY",
      index: true,
    },
    cancellationStatus: {
      type: String,
      enum: ["NONE", "REQUESTED", "CANCELLED", "FAILED"],
      default: "NONE",
    },
    cancellationTimestamp: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: "",
    },
    externalReference: {
      provider: { type: String, trim: true, default: "" },
      requestId: { type: String, trim: true, default: "" },
      environment: { type: String, trim: true, default: "" },
    },
    lastReadinessStatus: {
      type: String,
      trim: true,
      default: "",
    },
    lastReadinessErrors: {
      type: [String],
      default: [],
    },
    payloadVersion: {
      type: String,
      trim: true,
      default: "GST_EINV_V1",
      immutable: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      immutable: true,
    },
  },
  { timestamps: true }
);

eInvoiceMetadataSchema.index({ businessId: 1, invoiceId: 1 }, { unique: true });
eInvoiceMetadataSchema.index(
  { businessId: 1, irn: 1 },
  { unique: true, partialFilterExpression: { irn: { $type: "string", $gt: "" } } }
);
eInvoiceMetadataSchema.index({ businessId: 1, eInvoiceStatus: 1, updatedAt: -1 });

module.exports = mongoose.model("EInvoiceMetadata", eInvoiceMetadataSchema);
