const mongoose = require("mongoose");

const invoiceHistorySchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      trim: true,
      default: "draft",
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    billingAddress: {
      type: String,
      trim: true,
      default: "",
    },
    shippingAddress: {
      type: String,
      trim: true,
      default: "",
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    invoiceHistory: {
      type: [invoiceHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

customerSchema.index({ businessId: 1, name: 1 });
customerSchema.index({ businessId: 1, email: 1 });
customerSchema.index({ businessId: 1, phone: 1 });
customerSchema.index({ businessId: 1, _id: 1 });

module.exports = mongoose.model("Customer", customerSchema);
