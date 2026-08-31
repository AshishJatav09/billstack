const mongoose = require("mongoose");

const messageDeliverySchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null, index: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null, index: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "MessageTemplate", default: null },
    reminderJobId: { type: mongoose.Schema.Types.ObjectId, ref: "ScheduledReminder", default: null, index: true },
    channel: { type: String, enum: ["WHATSAPP", "EMAIL", "SMS", "IN_APP"], required: true, index: true },
    subject: { type: String, trim: true, default: "" },
    content: { type: String, required: true, trim: true },
    recipient: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["QUEUED", "SCHEDULED", "PROCESSING", "SENT", "DELIVERED", "READ", "FAILED", "CANCELLED", "SKIPPED"], default: "QUEUED", index: true },
    provider: { type: String, trim: true, default: "" },
    providerMessageId: { type: String, trim: true, default: "" },
    providerReference: { type: String, trim: true, default: "" },
    retryCount: { type: Number, default: 0, min: 0 },
    nextRetryAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, trim: true, default: "" },
    lastAttemptAt: { type: Date, default: null },
    failureReason: { type: String, trim: true, default: "" },
    cancellationReason: { type: String, trim: true, default: "" },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    usageTimestamp: { type: Date, default: null },
    sourceKey: { type: String, required: true, trim: true },
    metadata: { type: Object, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

messageDeliverySchema.index({ businessId: 1, sourceKey: 1 }, { unique: true });
messageDeliverySchema.index({ businessId: 1, status: 1, createdAt: -1 });
messageDeliverySchema.index({ businessId: 1, status: 1, nextRetryAt: 1 });
messageDeliverySchema.index({ businessId: 1, status: 1, lockedAt: 1 });
messageDeliverySchema.index({ businessId: 1, channel: 1, usageTimestamp: -1 });
messageDeliverySchema.index(
  { provider: 1, providerMessageId: 1 },
  { partialFilterExpression: { providerMessageId: { $gt: "" } } }
);

module.exports = mongoose.model("MessageDelivery", messageDeliverySchema);
