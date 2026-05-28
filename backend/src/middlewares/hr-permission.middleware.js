const AppError = require("../utils/appError");

const hasHrPermission = (user, permissionKey) => {
  if (!user) {
    return false;
  }

  if (["owner", "admin"].includes(user.role)) {
    return true;
  }

  if (permissionKey === "view") {
    return Boolean(user.permissions?.canViewHR || user.permissions?.canManageHR);
  }

  return Boolean(user.permissions?.canManageHR);
};

const requireHRViewAccess = (req, _res, next) => {
  if (!hasHrPermission(req.user, "view")) {
    throw new AppError("You do not have permission to view HR records", 403);
  }

  next();
};

const requireHRManageAccess = (req, _res, next) => {
  if (!hasHrPermission(req.user, "manage")) {
    throw new AppError("You do not have permission to manage HR records", 403);
  }

  next();
};

module.exports = {
  requireHRManageAccess,
  requireHRViewAccess,
};
