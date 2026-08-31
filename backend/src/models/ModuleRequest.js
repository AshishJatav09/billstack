const mongoose = require("mongoose");
const { MODULE_REQUEST_STATUSES } = require("../constants/modules");

const moduleRequestSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    moduleKey: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    requestType: {
      type: String,
      enum: ["MODULE", "ADD_ON", "CUSTOM"],
      default: "MODULE",
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: Object.values(MODULE_REQUEST_STATUSES),
      default: MODULE_REQUEST_STATUSES.PENDING,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    adminNote: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

moduleRequestSchema.index(
  { businessId: 1, moduleKey: 1, requestType: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["PENDING", "UNDER_REVIEW", "APPROVED"] },
      moduleKey: { $type: "string" },
    },
  }
);

module.exports = mongoose.model("ModuleRequest", moduleRequestSchema);
