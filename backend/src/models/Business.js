const mongoose = require("mongoose");

const bankDetailsSchema = new mongoose.Schema(
  {
    accountName: {
      type: String,
      trim: true,
      default: "",
    },
    bankName: {
      type: String,
      trim: true,
      default: "",
    },
    accountNumber: {
      type: String,
      trim: true,
      default: "",
    },
    ifscCode: {
      type: String,
      trim: true,
      default: "",
    },
    upiId: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const defaultTaxSettingsSchema = new mongoose.Schema(
  {
    taxName: {
      type: String,
      trim: true,
      default: "GST",
    },
    taxRate: {
      type: Number,
      default: 18,
    },
    taxMode: {
      type: String,
      enum: ["exclusive", "inclusive"],
      default: "exclusive",
    },
  },
  { _id: false }
);

const invoiceNumberingSchema = new mongoose.Schema(
  {
    prefix: {
      type: String,
      trim: true,
      default: "INV",
    },
    format: {
      type: String,
      trim: true,
      default: "INV-{YYYY}-{0001}",
    },
    nextSequence: {
      type: Number,
      default: 1,
    },
  },
  { _id: false }
);

const invoiceUsageSchema = new mongoose.Schema(
  {
    monthKey: {
      type: String,
      default: "",
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const inventorySettingsSchema = new mongoose.Schema(
  {
    allowNegativeStock: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const businessSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    industry: {
      type: String,
      trim: true,
      default: "",
    },
    billingEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    logoUrl: {
      type: String,
      default: "",
    },
    gstTaxId: {
      type: String,
      trim: true,
      default: "",
    },
    bankDetails: {
      type: bankDetailsSchema,
      default: () => ({}),
    },
    invoiceTerms: {
      type: String,
      trim: true,
      default: "",
    },
    defaultTaxSettings: {
      type: defaultTaxSettingsSchema,
      default: () => ({}),
    },
    invoiceNumbering: {
      type: invoiceNumberingSchema,
      default: () => ({}),
    },
    planCode: {
      type: String,
      enum: ["free", "basic", "pro", "enterprise"],
      default: "free",
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
    invoiceUsage: {
      type: invoiceUsageSchema,
      default: () => ({}),
    },
    inventorySettings: {
      type: inventorySettingsSchema,
      default: () => ({}),
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Business", businessSchema);
