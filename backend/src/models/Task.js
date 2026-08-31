const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"], default: "TODO", index: true },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], default: "MEDIUM", index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    parentTaskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    dueDate: { type: Date, default: null, index: true },
    completedAt: { type: Date, default: null },
    tags: [{ type: String, trim: true }],
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

taskSchema.index({ businessId: 1, assignedTo: 1, status: 1 });
taskSchema.index({ businessId: 1, projectId: 1, status: 1 });
taskSchema.index({ businessId: 1, dueDate: 1 });

module.exports = mongoose.model("Task", taskSchema);
