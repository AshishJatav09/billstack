const mongoose = require("mongoose");

const reminderRuleSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    name: { type: String, required: true, trim: true },
    trigger: { type: String, enum: ["BEFORE_DUE", "ON_DUE_DATE", "AFTER_DUE", "RECURRING_OVERDUE", "MANUAL"], required: true },
    offsetDays: { type: Number, default: 0 },
    channels: { type: [String], enum: ["WHATSAPP", "EMAIL", "SMS", "IN_APP"], default: ["EMAIL"] },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "MessageTemplate", default: null },
    timezone: { type: String, trim: true, default: "Asia/Kolkata" },
    sendTime: { type: String, trim: true, default: "10:00" },
    isEnabled: { type: Boolean, default: true },
    sourceKey: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

reminderRuleSchema.index({ businessId: 1, sourceKey: 1 }, { unique: true });
reminderRuleSchema.index({ businessId: 1, isEnabled: 1, trigger: 1 });

module.exports = mongoose.model("ReminderRule", reminderRuleSchema);
