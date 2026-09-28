const mongoose = require("mongoose");

const integrationCustomerMappingSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, immutable: true, index: true },
    credentialId: { type: mongoose.Schema.Types.ObjectId, ref: "IntegrationCredential", required: true, immutable: true },
    source: { type: String, required: true, trim: true, uppercase: true, immutable: true },
    externalId: { type: String, required: true, trim: true, immutable: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, immutable: true, index: true },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

integrationCustomerMappingSchema.index({ businessId: 1, source: 1, externalId: 1 }, { unique: true });
integrationCustomerMappingSchema.index({ businessId: 1, customerId: 1 });

module.exports = mongoose.model("IntegrationCustomerMapping", integrationCustomerMappingSchema);
