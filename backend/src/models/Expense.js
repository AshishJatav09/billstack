const mongoose = require("mongoose");
const {
  EXPENSE_CATEGORIES,
  EXPENSE_GST_TYPES,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_STATUSES,
  EXPENSE_STATUSES,
} = require("../constants/expenses");

const expenseAttachmentSchema = new mongoose.Schema(
  {
    originalName: { type: String, trim: true, default: "" },
    mimeType: { type: String, trim: true, default: "" },
    size: { type: Number, default: 0, min: 0 },
    url: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    expenseNumber: { type: String, required: true, trim: true },
    expenseDate: { type: Date, required: true, index: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, default: "Miscellaneous", index: true },
    customCategory: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    vendorName: { type: String, trim: true, default: "" },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null, index: true },
    amountBeforeTax: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    balanceAmount: { type: Number, default: 0, min: 0 },
    gstEnabled: { type: Boolean, default: false },
    gstRate: { type: Number, default: 0, min: 0, max: 100 },
    gstType: { type: String, enum: EXPENSE_GST_TYPES, default: "NONE" },
    gstSnapshot: { type: Object, default: null },
    paymentStatus: { type: String, enum: EXPENSE_PAYMENT_STATUSES, default: "UNPAID", index: true },
    paymentMethod: { type: String, enum: EXPENSE_PAYMENT_METHODS, default: "" },
    referenceNumber: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    receipt: { type: expenseAttachmentSchema, default: () => ({}) },
    status: { type: String, enum: EXPENSE_STATUSES, default: "ACTIVE", index: true },
    cancellationReason: { type: String, trim: true, default: "" },
    cancelledAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

expenseSchema.index({ businessId: 1, expenseNumber: 1 }, { unique: true });
expenseSchema.index({ businessId: 1, expenseDate: -1 });
expenseSchema.index({ businessId: 1, category: 1, expenseDate: -1 });
expenseSchema.index({ businessId: 1, paymentStatus: 1, expenseDate: -1 });
expenseSchema.index({ businessId: 1, status: 1, expenseDate: -1 });

module.exports = mongoose.model("Expense", expenseSchema);
