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
      enum: ["free", "basic", "pro", "enterprise"],
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
        "created",
        "authenticated",
        "active",
        "pending",
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
      enum: ["", "free", "basic", "pro", "enterprise"],
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("BusinessSubscription", businessSubscriptionSchema);

