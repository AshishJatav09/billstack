const mongoose = require("mongoose");
const { MODULE_STATES } = require("../constants/modules");

const businessModuleConfigSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    moduleKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    state: {
      type: String,
      enum: Object.values(MODULE_STATES),
      default: MODULE_STATES.ACTIVE,
    },
    source: {
      type: String,
      enum: ["DEFAULT", "ONBOARDING", "SETTINGS", "SUPER_ADMIN", "SYSTEM"],
      default: "DEFAULT",
    },
    configuredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

businessModuleConfigSchema.index({ businessId: 1, moduleKey: 1 }, { unique: true });

module.exports = mongoose.model("BusinessModuleConfig", businessModuleConfigSchema);
