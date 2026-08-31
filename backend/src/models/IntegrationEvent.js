const mongoose = require("mongoose");

const integrationEventSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    credentialId: { type: mongoose.Schema.Types.ObjectId, ref: "IntegrationCredential", required: true, index: true },
    source: { type: String, trim: true, uppercase: true, default: "API", index: true },
    externalOrderId: { type: String, trim: true, required: true },
    payloadHash: { type: String, required: true },
    status: { type: String, enum: ["PROCESSING", "PROCESSED", "FAILED", "CONFLICT"], default: "PROCESSING", index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
    allocationId: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentAllocation", default: null },
    errorMessage: { type: String, trim: true, default: "" },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

integrationEventSchema.index({ businessId: 1, source: 1, externalOrderId: 1 }, { unique: true });
integrationEventSchema.index({ businessId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("IntegrationEvent", integrationEventSchema);
