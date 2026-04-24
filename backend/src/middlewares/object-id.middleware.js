const mongoose = require("mongoose");
const AppError = require("../utils/appError");

const validateObjectIdParam = (paramName) => (req, _res, next) => {
  const value = req.params[paramName];

  if (!value) {
    return next();
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${paramName}`, 400);
  }

  return next();
};

module.exports = {
  validateObjectIdParam,
};
