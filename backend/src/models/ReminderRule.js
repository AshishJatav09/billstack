const mongoose = require("mongoose");

const reminderRuleSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: true, trim: true },
    trigger: { type: String, enum: ["BEFORE_DUE_DATE", "BEFORE_DUE", "ON_DUE_DATE", "AFTER_DUE_DATE", "AFTER_DUE", "RECURRING_OVERDUE", "INVOICE_ISSUED", "PAYMENT_RECORDED", "MANUAL"], required: true },
    offsetDays: { type: Number, default: 0 },
    repeatEveryDays: { type: Number, default: 0, min: 0 },
    channels: { type: [String], enum: ["WHATSAPP", "EMAIL", "SMS", "IN_APP"], default: ["EMAIL"] },
    category: { type: String, enum: ["INVOICE_CREATED", "INVOICE_DUE_SOON", "DUE_TODAY", "PAYMENT_OVERDUE", "PAYMENT_REMINDER", "PAYMENT_RECEIVED", "QUOTATION", "CREDIT_NOTE", "SALES_RETURN", "CUSTOM"], default: "PAYMENT_OVERDUE" },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "MessageTemplate", default: null },
    timezone: { type: String, trim: true, default: "Asia/Kolkata" },
    sendTime: { type: String, trim: true, default: "10:00" },
    condition: { type: String, enum: ["ANY_PAYMENT", "PARTIAL_PAYMENT", "FULL_PAYMENT"], default: "ANY_PAYMENT" },
    isEnabled: { type: Boolean, default: true },
    sourceKey: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

reminderRuleSchema.index({ businessId: 1, sourceKey: 1 }, { unique: true });
reminderRuleSchema.index({ businessId: 1, isEnabled: 1, trigger: 1 });

module.exports = mongoose.model("ReminderRule", reminderRuleSchema);
