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

  if (!body.name || body.name.trim().length < 2) {
    errors.name = "Business name must be at least 2 characters";
  }

  if (body.billingEmail && !isEmail(body.billingEmail)) {
    errors.billingEmail = "Billing email must be valid";
  }

  if (body.email && !isEmail(body.email)) {
    errors.email = "Business email must be valid";
  }

  if (body.taxRate !== undefined && Number.isNaN(Number(body.taxRate))) {
    errors.taxRate = "Tax rate must be a valid number";
  }

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
  loginValidator,
  planUpdateValidator,
  registerValidator,
};
