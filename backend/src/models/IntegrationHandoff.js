const mongoose = require("mongoose");

const integrationHandoffSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, immutable: true, index: true },
    credentialId: { type: mongoose.Schema.Types.ObjectId, ref: "IntegrationCredential", required: true, immutable: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, immutable: true },
    tokenHash: { type: String, required: true, immutable: true, unique: true, select: false },
    purpose: { type: String, enum: ["INVOICE_CREATE"], default: "INVOICE_CREATE", immutable: true },
    returnUrl: { type: String, trim: true, default: "" },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

integrationHandoffSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
integrationHandoffSchema.index({ businessId: 1, customerId: 1, purpose: 1 });

module.exports = mongoose.model("IntegrationHandoff", integrationHandoffSchema);
