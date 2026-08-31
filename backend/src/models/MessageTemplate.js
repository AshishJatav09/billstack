const mongoose = require("mongoose");

const messageTemplateSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    channel: { type: String, enum: ["WHATSAPP", "EMAIL", "SMS", "IN_APP"], required: true },
    subject: { type: String, trim: true, default: "" },
    body: { type: String, required: true, trim: true },
    variables: { type: [String], default: [] },
    category: { type: String, enum: ["INVOICE_CREATED", "INVOICE_DUE_SOON", "DUE_TODAY", "PAYMENT_OVERDUE", "PAYMENT_RECEIVED", "QUOTATION", "CREDIT_NOTE", "CUSTOM"], default: "CUSTOM" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

messageTemplateSchema.index({ businessId: 1, code: 1, channel: 1 }, { unique: true });
messageTemplateSchema.index({ businessId: 1, category: 1, isActive: 1 });

module.exports = mongoose.model("MessageTemplate", messageTemplateSchema);
