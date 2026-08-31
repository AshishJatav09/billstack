const asyncHandler = require("../utils/asyncHandler");
const { assertModuleActive } = require("../services/module.service");

const requireModule = (moduleKey) =>
  asyncHandler(async (req, _res, next) => {
    await assertModuleActive({ businessId: req.tenant.businessId, moduleKey });
    next();
  });

module.exports = {
  requireModule,
};
