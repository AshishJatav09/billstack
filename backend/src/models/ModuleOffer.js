const mongoose = require("mongoose");

const moduleOfferSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    moduleKey: { type: String, required: true, lowercase: true, trim: true, index: true },
    moduleRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "ModuleRequest", default: null, index: true },
    standardPrice: { type: Number, default: 0 },
    negotiatedPrice: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    finalAmount: { type: Number, default: 0 },
    currency: { type: String, enum: ["INR"], default: "INR" },
    pricingType: { type: String, enum: ["FREE", "ONE_TIME", "MONTHLY", "YEARLY", "CUSTOM"], default: "FREE" },
    commercialType: { type: String, enum: ["FREE", "PLAN_INCLUDED", "PAID_ADDON", "CONTACT_SALES"], default: "FREE" },
    status: {
      type: String,
      enum: ["DRAFT", "OFFERED", "ACCEPTED", "REJECTED", "EXPIRED", "PAYMENT_PENDING", "PAID", "CANCELLED", "ACTIVATED"],
      default: "DRAFT",
      index: true,
    },
    adminNote: { type: String, trim: true, default: "" },
    customerNote: { type: String, trim: true, default: "" },
    offeredBy: { type: String, trim: true, default: "" },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    validUntil: { type: Date, default: null },
    revision: { type: Number, default: 1 },
    sourceKey: { type: String, required: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

moduleOfferSchema.index({ businessId: 1, moduleKey: 1, status: 1 });
moduleOfferSchema.index({ sourceKey: 1 }, { unique: true });

module.exports = mongoose.model("ModuleOffer", moduleOfferSchema);
