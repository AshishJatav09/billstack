const mongoose = require("mongoose");

const moduleOrderSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: "ModuleOffer", required: true, index: true },
    moduleKey: { type: String, required: true, lowercase: true, trim: true, index: true },
    amount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    currency: { type: String, enum: ["INR"], default: "INR" },
    paymentMethod: { type: String, enum: ["RAZORPAY", "MANUAL_UPI", "ADMIN_MARKED"], required: true },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "AWAITING_VERIFICATION", "PAID", "FAILED", "REJECTED", "REFUNDED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    activationStatus: { type: String, enum: ["PENDING", "ACTIVATED", "REVOKED"], default: "PENDING", index: true },
    providerOrderId: { type: String, trim: true, default: "", index: true },
    providerPaymentId: { type: String, trim: true, default: "", index: true },
    providerReference: { type: String, trim: true, default: "" },
    utrReference: { type: String, trim: true, uppercase: true, default: "" },
    manualPaymentDate: { type: Date, default: null },
    customerNote: { type: String, trim: true, default: "" },
    adminNote: { type: String, trim: true, default: "" },
    idempotencyKey: { type: String, required: true },
    paidAt: { type: Date, default: null },
    activatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

moduleOrderSchema.index({ businessId: 1, offerId: 1, paymentMethod: 1 }, { unique: true });
moduleOrderSchema.index({ idempotencyKey: 1 }, { unique: true });
moduleOrderSchema.index(
  { utrReference: 1 },
  { unique: true, partialFilterExpression: { utrReference: { $type: "string", $gt: "" } } }
);

module.exports = mongoose.model("ModuleOrder", moduleOrderSchema);
