const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    projectNumber: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    description: { type: String, trim: true, default: "" },
    projectType: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"], default: "PLANNING", index: true },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], default: "MEDIUM", index: true },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null, index: true },
    completedAt: { type: Date, default: null },
    assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    estimatedValue: { type: Number, default: 0, min: 0 },
    linkedQuoteId: { type: mongoose.Schema.Types.ObjectId, ref: "Quote", default: null },
    linkedOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
    linkedInvoiceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Invoice" }],
    tags: [{ type: String, trim: true }],
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

projectSchema.index({ businessId: 1, projectNumber: 1 }, { unique: true });
projectSchema.index({ businessId: 1, customerId: 1, status: 1 });
projectSchema.index({ businessId: 1, status: 1, dueDate: 1 });

module.exports = mongoose.model("Project", projectSchema);
