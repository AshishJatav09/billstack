const sanitizePayload = (value) => {
  if (Array.isArray(value)) {
    return value.map(sanitizePayload);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, sanitizePayload(nestedValue)])
    );
  }

  return typeof value === "string" ? value.trim() : value;
};

const validate = (schema) => (req, res, next) => {
  req.body = sanitizePayload(req.body);
  const result = schema(req.body);

  if (!result.valid) {
    return res.status(400).json({
      message: "Validation failed",
      errors: result.errors,
    });
  }

  return next();
};

module.exports = validate;
