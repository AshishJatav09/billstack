const { ROLES } = require("../constants/roles");
const { PLAN_DEFINITIONS } = require("../constants/plans");

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const loginValidator = (body) => {
  const errors = {};

  if (!body.email || !isEmail(body.email)) {
    errors.email = "A valid email is required";
  }

  if (!body.password || body.password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const forgotPasswordValidator = (body) => {
  const errors = {};

  if (!body.email || !isEmail(body.email)) {
    errors.email = "A valid email is required";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const resetPasswordValidator = (body) => {
  const errors = {};

  if (!body.token || String(body.token).trim().length < 32) {
    errors.token = "A valid reset token is required";
  }

  if (!body.password || body.password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const registerValidator = (body) => {
  const errors = {};

  if (!body.name || body.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters";
  }

  if (!body.email || !isEmail(body.email)) {
    errors.email = "A valid email is required";
  }

  if (!body.password || body.password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  if (!body.businessName || body.businessName.trim().length < 2) {
    errors.businessName = "Business name must be at least 2 characters";
  }

  if (body.role && !Object.values(ROLES).includes(body.role)) {
    errors.role = "Invalid role selected";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const businessSetupValidator = (body) => {
  const errors = {};

  if (body.updateScope === "branding") {
    for (const field of ["removeLogo", "removeSignature"]) {
      if (body[field] !== undefined && !["true", "false", true, false].includes(body[field])) errors[field] = `${field} must be true or false`;
    }
    return { valid: Object.keys(errors).length === 0, errors };
  }

  if (!body.name || body.name.trim().length < 2) {
    errors.name = "Business name must be at least 2 characters";
  }

  if (body.billingEmail && !isEmail(String(body.billingEmail).trim())) {
    errors.billingEmail = "Billing email must be valid";
  }

  if (body.email && !isEmail(String(body.email).trim())) {
    errors.email = "Business email must be valid";
  }

  if (body.taxRate !== undefined && (!Number.isFinite(Number(body.taxRate)) || Number(body.taxRate) < 0 || Number(body.taxRate) > 100)) {
    errors.taxRate = "Tax rate must be between 0 and 100";
  }
  if (body.taxMode && body.taxMode !== "exclusive") errors.taxMode = "Only Tax Exclusive is currently supported";
  if (body.bankIfscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(body.bankIfscCode).trim().toUpperCase())) errors.bankIfscCode = "Enter a valid 11-character IFSC";
  if (body.bankUpiId && !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+$/.test(String(body.bankUpiId).trim())) errors.bankUpiId = "Enter a valid UPI ID";
  if (body.bankAccountNumber !== undefined && typeof body.bankAccountNumber !== "string") errors.bankAccountNumber = "Account number must be supplied as text";

  if (
    body.allowNegativeStock !== undefined &&
    !["true", "false", true, false].includes(body.allowNegativeStock)
  ) {
    errors.allowNegativeStock = "Allow negative stock must be true or false";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const planUpdateValidator = (body) => {
  const errors = {};

  if (!body.planCode || !PLAN_DEFINITIONS[body.planCode]) {
    errors.planCode = "A valid plan code is required";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

module.exports = {
  businessSetupValidator,
  forgotPasswordValidator,
  loginValidator,
  planUpdateValidator,
  registerValidator,
  resetPasswordValidator,
};
