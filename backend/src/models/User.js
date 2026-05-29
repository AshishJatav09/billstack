const mongoose = require("mongoose");

const roles = ["owner", "admin", "staff", "accountant"];

const userSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: roles,
      default: "staff",
    },
    permissions: {
      canManageHR: {
        type: Boolean,
        default: false,
      },
      canViewHR: {
        type: Boolean,
        default: false,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    passwordResetToken: {
      type: String,
      default: "",
      select: false,
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ businessId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
