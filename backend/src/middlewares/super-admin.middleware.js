const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const { verifySuperAdminToken } = require("../services/super-admin.service");

const requireSuperAdmin = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    throw new AppError("Super admin authentication required", 401);
  }

  try {
    const decoded = verifySuperAdminToken(token);
    req.superAdmin = decoded;
    next();
  } catch (_error) {
    throw new AppError("Invalid or expired super admin token", 401);
  }
});

module.exports = {
  requireSuperAdmin,
};

