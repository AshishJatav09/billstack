const mongoose = require("mongoose");

const orderLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    fulfilledQuantity: { type: Number, default: 0, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    discountType: { type: String, enum: ["percent", "amount"], default: "percent" },
    discountValue: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0, min: 0 },
    itemTotal: { type: Number, required: true, min: 0 },
    snapshot: { type: Object, default: {} },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    orderNumber: { type: String, required: true, trim: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    quoteId: { type: mongoose.Schema.Types.ObjectId, ref: "Quote", default: null, index: true },
    orderDate: { type: Date, default: Date.now, index: true },
    expectedDeliveryDate: { type: Date, default: null },
    lineItems: { type: [orderLineSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    totalTax: { type: Number, default: 0, min: 0 },
    totalDiscount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    gstSnapshot: { type: Object, default: null },
    customerSnapshot: { type: Object, default: {} },
    businessSnapshot: { type: Object, default: {} },
    notes: { type: String, trim: true, default: "" },
    terms: { type: String, trim: true, default: "" },
    internalNotes: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["DRAFT", "CONFIRMED", "PROCESSING", "PARTIALLY_FULFILLED", "FULFILLED", "CANCELLED"], default: "DRAFT", index: true },
    fulfilmentStatus: { type: String, enum: ["NOT_STARTED", "PARTIAL", "FULFILLED"], default: "NOT_STARTED", index: true },
    invoiceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Invoice" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

orderSchema.index({ businessId: 1, orderNumber: 1 }, { unique: true });
orderSchema.index(
  { businessId: 1, quoteId: 1 },
  { unique: true, partialFilterExpression: { quoteId: { $type: "objectId" } } }
);
orderSchema.index({ businessId: 1, customerId: 1, orderDate: -1 });
orderSchema.index({ businessId: 1, status: 1, orderDate: -1 });
orderSchema.index({ businessId: 1, fulfilmentStatus: 1, expectedDeliveryDate: 1 });

module.exports = mongoose.model("Order", orderSchema);
