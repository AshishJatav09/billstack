const mongoose = require("mongoose");

const integrationCredentialSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true, immutable: true },
    name: { type: String, trim: true, required: true },
    source: { type: String, trim: true, uppercase: true, default: "API" },
    keyPrefix: { type: String, trim: true, required: true, immutable: true },
    keyHash: { type: String, required: true, immutable: true },
    scopes: { type: [String], default: ["orders:write"] },
    status: { type: String, enum: ["ACTIVE", "REVOKED"], default: "ACTIVE", index: true },
    lastUsedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

integrationCredentialSchema.index({ businessId: 1, keyPrefix: 1 }, { unique: true });
integrationCredentialSchema.index({ keyPrefix: 1, status: 1 });

module.exports = mongoose.model("IntegrationCredential", integrationCredentialSchema);
