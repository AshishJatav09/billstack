const mongoose = require("mongoose");

const commercialPlanSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      enum: ["free", "starter", "growth", "pro", "enterprise"],
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    shortDescription: { type: String, trim: true, default: "" },
    longDescription: { type: String, trim: true, default: "" },
    monthlyPrice: { type: Number, min: 0, default: 0 },
    yearlyPrice: { type: Number, min: 0, default: 0 },
    currency: { type: String, enum: ["INR"], default: "INR" },
    trialEligible: { type: Boolean, default: false },
    trialDays: { type: Number, min: 0, max: 365, default: 0 },
    active: { type: Boolean, default: true, index: true },
    publicVisible: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 100 },
    recommended: { type: Boolean, default: false },
    badgeText: { type: String, trim: true, default: "" },
    limits: {
      monthlyInvoices: { type: Number, min: 0, default: 0 },
      users: { type: Number, min: 0, default: 1 },
      businesses: { type: Number, min: 0, default: 1 },
      locations: { type: Number, min: 0, default: 1 },
      customers: { type: Number, min: 0, default: 0 },
      products: { type: Number, min: 0, default: 0 },
      storageMB: { type: Number, min: 0, default: 0 },
      whatsappQuota: { type: Number, min: 0, default: 0 },
      apiQuota: { type: Number, min: 0, default: 0 },
    },
    entitlements: {
      inventory: { type: Boolean, default: false },
      purchases: { type: Boolean, default: false },
      expenses: { type: Boolean, default: false },
      quotations: { type: Boolean, default: true },
      creditNotes: { type: Boolean, default: false },
      salesReturns: { type: Boolean, default: false },
      reports: { type: Boolean, default: false },
      pdfTemplates: { type: Boolean, default: false },
      sharing: { type: Boolean, default: false },
      communications: { type: Boolean, default: false },
      advancedGst: { type: Boolean, default: false },
      eInvoice: { type: Boolean, default: false },
      api: { type: Boolean, default: false },
      hr: { type: Boolean, default: false },
      industryModules: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

commercialPlanSchema.index({ publicVisible: 1, active: 1, displayOrder: 1 });

module.exports = mongoose.model("CommercialPlan", commercialPlanSchema);
