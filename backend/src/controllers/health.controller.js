const asyncHandler = require("../utils/asyncHandler");

const getHealth = asyncHandler(async (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "billstack-backend",
    timestamp: new Date().toISOString(),
  });
});

module.exports = {
  getHealth,
};

