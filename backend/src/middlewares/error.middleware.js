const { log } = require("../utils/logger");

const notFound = (req, _res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const errorHandler = (error, req, res, _next) => {
  if (error.name === "CastError") {
    error.statusCode = 400;
    error.message = `Invalid ${error.path}`;
  }

  const statusCode = error.statusCode || 500;
  const requestId = req.requestId || "unknown";

  if (statusCode >= 500) {
    log("error", error.message || "Unhandled server error", {
      requestId,
      path: req.originalUrl,
      method: req.method,
      stack: error.stack,
    });
  }

  res.status(statusCode).json({
    message: error.message || "Internal server error",
    requestId,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
  });
};

module.exports = {
  notFound,
  errorHandler,
};
