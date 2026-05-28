const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    employeeCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
      default: "",
    },
    joiningDate: {
      type: Date,
      required: true,
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
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

employeeSchema.index({ businessId: 1, employeeCode: 1 }, { unique: true });

module.exports = mongoose.model("Employee", employeeSchema);
