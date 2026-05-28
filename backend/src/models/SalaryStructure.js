const mongoose = require("mongoose");

const salaryStructureSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    salaryType: {
      type: String,
      enum: ["monthly", "daily", "commission", "mixed"],
      required: true,
    },
    baseSalary: {
      type: Number,
      default: 0,
      min: 0,
    },
    dailyWage: {
      type: Number,
      default: 0,
      min: 0,
    },
    commissionEnabled: {
      type: Boolean,
      default: false,
    },
    commissionType: {
      type: String,
      enum: ["percentage", "fixed", "none"],
      default: "none",
    },
    commissionValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    effectiveFrom: {
      type: Date,
      required: true,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

salaryStructureSchema.index({ businessId: 1, employeeId: 1, effectiveFrom: 1 });

module.exports = mongoose.model("SalaryStructure", salaryStructureSchema);
