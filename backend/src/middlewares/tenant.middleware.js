const AppError = require("../utils/appError");

const tenantMiddleware = (req, _res, next) => {
  if (!req.user) {
    throw new AppError("Tenant enforcement requires an authenticated user", 401);
  }

  const businessHeader = req.headers["x-business-id"];
  const tokenBusinessId = req.user.businessId.toString();

  if (businessHeader && businessHeader !== tokenBusinessId) {
    throw new AppError("Cross-business access is not allowed", 403);
  }

  if (req.params.businessId && req.params.businessId !== tokenBusinessId) {
    throw new AppError("Route business scope does not match your account", 403);
  }

  req.tenant = {
    businessId: tokenBusinessId,
  };

  next();
};

module.exports = tenantMiddleware;

