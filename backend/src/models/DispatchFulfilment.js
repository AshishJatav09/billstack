const mongoose = require("mongoose");

const dispatchItemSchema = new mongoose.Schema(
  {
    orderLineId: { type: mongoose.Schema.Types.ObjectId, default: null },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, trim: true, default: "" },
    quantity: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const dispatchFulfilmentSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    sourceKey: { type: String, trim: true, default: "" },
    dispatchNumber: { type: String, required: true, trim: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    items: { type: [dispatchItemSchema], default: [] },
    status: { type: String, enum: ["DRAFT", "PACKED", "DISPATCHED", "DELIVERED", "CANCELLED"], default: "DRAFT", index: true },
    carrier: { type: String, trim: true, default: "" },
    trackingNumber: { type: String, trim: true, default: "" },
    dispatchDate: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

dispatchFulfilmentSchema.index({ businessId: 1, dispatchNumber: 1 }, { unique: true });
dispatchFulfilmentSchema.index({ businessId: 1, sourceKey: 1 }, { unique: true, partialFilterExpression: { sourceKey: { $type: "string", $gt: "" } } });
dispatchFulfilmentSchema.index({ businessId: 1, status: 1, dispatchDate: -1 });

module.exports = mongoose.model("DispatchFulfilment", dispatchFulfilmentSchema);
