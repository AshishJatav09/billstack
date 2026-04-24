const asyncHandler = require("../utils/asyncHandler");

const getInventoryAccess = asyncHandler(async (req, res) => {
  res.status(200).json({
    message: "Inventory access granted",
    data: {
      feature: "inventory",
      plan: req.plan,
      businessId: req.tenant.businessId,
    },
  });
});

const getReportsAccess = asyncHandler(async (req, res) => {
  res.status(200).json({
    message: "Reports access granted",
    data: {
      feature: "reports",
      plan: req.plan,
      businessId: req.tenant.businessId,
    },
  });
});

const getPdfTemplatesAccess = asyncHandler(async (req, res) => {
  res.status(200).json({
    message: "PDF templates access granted",
    data: {
      feature: "pdfTemplates",
      plan: req.plan,
      businessId: req.tenant.businessId,
    },
  });
});

const getSharingAccess = asyncHandler(async (req, res) => {
  res.status(200).json({
    message: "Sharing access granted",
    data: {
      feature: "sharing",
      plan: req.plan,
      businessId: req.tenant.businessId,
    },
  });
});

module.exports = {
  getInventoryAccess,
  getPdfTemplatesAccess,
  getReportsAccess,
  getSharingAccess,
};
