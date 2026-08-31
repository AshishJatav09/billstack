const mongoose = require("mongoose");

const auditActorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    email: { type: String, trim: true, lowercase: true, default: "" },
    role: { type: String, trim: true, default: "" },
    type: { type: String, enum: ["USER", "INTEGRATION", "SYSTEM"], default: "USER" },
  },
  { _id: false }
);

const auditEntitySchema = new mongoose.Schema(
  {
    type: { type: String, trim: true, uppercase: true, default: "" },
    id: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { _id: false }
);

const auditLogSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", index: true, default: null, immutable: true },
    actor: { type: auditActorSchema, default: () => ({}) },
    action: { type: String, required: true, trim: true, uppercase: true, index: true, immutable: true },
    entity: { type: auditEntitySchema, default: () => ({}) },
    requestId: { type: String, trim: true, default: "", immutable: true },
    ipAddress: { type: String, trim: true, default: "", immutable: true },
    userAgent: { type: String, trim: true, default: "", immutable: true },
    metadata: { type: Object, default: {}, immutable: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ businessId: 1, createdAt: -1 });
auditLogSchema.index({ "entity.type": 1, "entity.id": 1, createdAt: -1 });
auditLogSchema.pre(["findOneAndUpdate", "updateOne", "updateMany"], () => {
  throw new Error("Audit logs are immutable.");
});

module.exports = mongoose.model("AuditLog", auditLogSchema);
