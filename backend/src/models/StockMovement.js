const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["IN", "OUT", "ADJUSTMENT", "RETURN", "DAMAGED", "OPENING"],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    referenceType: {
      type: String,
      enum: ["INVOICE", "PURCHASE", "MANUAL", "RETURN", ""],
      default: "MANUAL",
    },
    referenceId: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

stockMovementSchema.index({ businessId: 1, productId: 1, createdAt: -1 });

module.exports = mongoose.model("StockMovement", stockMovementSchema);

