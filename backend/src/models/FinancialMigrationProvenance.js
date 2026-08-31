const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, immutable: true },
  sourceType: { type: String, enum: ["INVOICE", "PURCHASE"], required: true, immutable: true },
  sourceDocumentId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  migrationType: { type: String, default: "LEGACY_PAYMENT_BACKFILL", immutable: true },
  migrationVersion: { type: String, default: "v1", immutable: true },
  state: { type: String, enum: ["NOT_STARTED", "MIGRATED", "EXCEPTION"], default: "NOT_STARTED", required: true },
  legacyPaidAmount: { type: Number, required: true, min: 0, immutable: true },
  migratedAllocatedAmount: { type: Number, default: 0, min: 0, immutable: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null, immutable: true },
  paymentAllocationId: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentAllocation", default: null, immutable: true },
  exceptionCode: { type: String, default: "", immutable: true },
  exceptionMessage: { type: String, default: "", immutable: true },
  completedAt: { type: Date, default: null, immutable: true },
}, { timestamps: true });

schema.index({ businessId: 1, sourceType: 1, sourceDocumentId: 1, migrationType: 1, migrationVersion: 1 }, { unique: true });
schema.pre(["findOneAndUpdate", "updateOne", "updateMany"], () => { throw new Error("Migration provenance is immutable."); });
module.exports = mongoose.model("FinancialMigrationProvenance", schema);
