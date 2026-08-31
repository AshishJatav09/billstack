const asyncHandler = require("../utils/asyncHandler");
const { authenticateIntegrationKey } = require("../services/integration.service");

const integrationAuthMiddleware = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const bearerKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const apiKey = req.headers["x-billstack-api-key"] || bearerKey;
  req.integrationCredential = await authenticateIntegrationKey(apiKey);
  next();
});

module.exports = integrationAuthMiddleware;
