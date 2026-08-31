const mongoose = require("mongoose");

const scheduledReminderSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: "ReminderRule", default: null, index: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "MessageTemplate", default: null },
    channel: { type: String, enum: ["WHATSAPP", "EMAIL", "SMS", "IN_APP"], required: true },
    scheduledFor: { type: Date, required: true, index: true },
    timezone: { type: String, trim: true, default: "Asia/Kolkata" },
    status: { type: String, enum: ["SCHEDULED", "PROCESSING", "SENT", "FAILED", "CANCELLED", "SKIPPED"], default: "SCHEDULED", index: true },
    outstandingAmountSnapshot: { type: Number, default: 0, min: 0 },
    retryCount: { type: Number, default: 0, min: 0 },
    nextRetryAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, trim: true, default: "" },
    lastAttemptAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    failureReason: { type: String, trim: true, default: "" },
    cancellationReason: { type: String, trim: true, default: "" },
    sourceKey: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

scheduledReminderSchema.index({ businessId: 1, sourceKey: 1 }, { unique: true });
scheduledReminderSchema.index({ businessId: 1, status: 1, scheduledFor: 1 });
scheduledReminderSchema.index({ businessId: 1, invoiceId: 1, status: 1 });
scheduledReminderSchema.index({ businessId: 1, status: 1, nextRetryAt: 1 });
scheduledReminderSchema.index({ businessId: 1, status: 1, lockedAt: 1 });

module.exports = mongoose.model("ScheduledReminder", scheduledReminderSchema);
