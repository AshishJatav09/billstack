const mongoose = require("mongoose");

const commercialModuleSchema = new mongoose.Schema(
  {
    moduleKey: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    shortDescription: { type: String, trim: true, default: "" },
    longDescription: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "BUSINESS" },
    commercialType: {
      type: String,
      enum: ["FREE", "PLAN_INCLUDED", "PAID_ADDON", "CONTACT_SALES"],
      default: "FREE",
      index: true,
    },
    pricingType: {
      type: String,
      enum: ["FREE", "ONE_TIME", "MONTHLY", "YEARLY", "CUSTOM"],
      default: "FREE",
    },
    defaultPrice: { type: Number, min: 0, default: 0 },
    currency: { type: String, enum: ["INR"], default: "INR" },
    gstApplicable: { type: Boolean, default: true },
    gstRate: { type: Number, min: 0, max: 28, default: 18 },
    negotiable: { type: Boolean, default: true },
    availableForSaas: { type: Boolean, default: true },
    availableForSelfHosted: { type: Boolean, default: true },
    active: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 100 },
    badgeText: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

commercialModuleSchema.index({ active: 1, displayOrder: 1 });

module.exports = mongoose.model("CommercialModule", commercialModuleSchema);
