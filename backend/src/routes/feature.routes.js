const express = require("express");

const {
  getInventoryAccess,
  getPdfTemplatesAccess,
  getReportsAccess,
  getSharingAccess,
} = require("../controllers/feature.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireFeature } = require("../middlewares/feature-guard.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");

const router = express.Router();

router.use(authMiddleware, tenantMiddleware);
router.get("/inventory", requireFeature("inventory"), getInventoryAccess);
router.get("/reports", requireFeature("reports"), getReportsAccess);
router.get("/pdf-templates", requireFeature("pdfTemplates"), getPdfTemplatesAccess);
router.get("/sharing", requireFeature("sharing"), getSharingAccess);

module.exports = router;
