const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    appointmentType: { type: String, trim: true, default: "" },
    assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, trim: true, default: "Asia/Kolkata" },
    locationType: { type: String, enum: ["OFFICE", "CUSTOMER_LOCATION", "ONLINE", "OTHER"], default: "OFFICE" },
    physicalLocation: { type: String, trim: true, default: "" },
    meetingLink: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"], default: "SCHEDULED", index: true },
    conflictOverride: { allowed: { type: Boolean, default: false }, reason: { type: String, trim: true, default: "" }, by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null } },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

appointmentSchema.index({ businessId: 1, startAt: 1 });
appointmentSchema.index({ businessId: 1, assignedUsers: 1, startAt: 1 });
appointmentSchema.index({ businessId: 1, customerId: 1, startAt: -1 });
appointmentSchema.index({ businessId: 1, status: 1, startAt: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
