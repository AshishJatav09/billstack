const mongoose = require("mongoose");

const businessSubscriptionSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
      index: true,
    },
    planCode: {
      type: String,
      enum: ["free", "starter", "growth", "basic", "pro", "enterprise"],
      required: true,
      default: "free",
    },
    razorpayPlanId: {
      type: String,
      trim: true,
      default: "",
    },
    razorpaySubscriptionId: {
      type: String,
      trim: true,
      default: "",
    },
    razorpayCustomerId: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: [
        "inactive",
        "free",
        "trial",
        "created",
        "authenticated",
        "active",
        "pending",
        "past_due",
        "grace_period",
        "halted",
        "cancelled",
        "completed",
        "expired",
      ],
      default: "inactive",
    },
    quantity: {
      type: Number,
      default: 1,
    },
    totalCount: {
      type: Number,
      default: 12,
    },
    paidCount: {
      type: Number,
      default: 0,
    },
    currentStart: {
      type: Date,
      default: null,
    },
    currentEnd: {
      type: Date,
      default: null,
    },
    expireBy: {
      type: Date,
      default: null,
    },
    shortUrl: {
      type: String,
      trim: true,
      default: "",
    },
    pendingPlanCode: {
      type: String,
      enum: ["", "free", "starter", "growth", "basic", "pro", "enterprise"],
      default: "",
    },
    scheduleChangeAt: {
      type: String,
      enum: ["", "now", "cycle_end"],
      default: "",
    },
    lastPaymentId: {
      type: String,
      trim: true,
      default: "",
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    trialEndsAt: {
      type: Date,
      default: null,
    },
    lifecycleStatus: {
      type: String,
      enum: ["FREE", "TRIAL", "ACTIVE", "PAST_DUE", "GRACE_PERIOD", "CANCELLED", "EXPIRED", ""],
      default: "",
      index: true,
    },
    trialStartedAt: {
      type: Date,
      default: null,
    },
    trialSource: {
      type: String,
      trim: true,
      default: "",
    },
    trialPlanCode: {
      type: String,
      enum: ["", "starter", "growth", "pro", "enterprise"],
      default: "",
    },
    trialConsumed: {
      type: Boolean,
      default: false,
      index: true,
    },
    graceEndsAt: {
      type: Date,
      default: null,
    },
    failedPaymentAt: {
      type: Date,
      default: null,
    },
    sourceOfTruthVersion: {
      type: String,
      default: "phase15",
    },
    addonEntitlements: {
      whatsappPackage: { type: Number, default: 0 },
      extraUsers: { type: Number, default: 0 },
      extraBusinesses: { type: Number, default: 0 },
      extraStorageGb: { type: Number, default: 0 },
      industryModules: { type: [String], default: [] },
      workflowModules: { type: [String], default: [] },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("BusinessSubscription", businessSubscriptionSchema);
