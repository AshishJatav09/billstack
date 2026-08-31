const express = require("express");

const { listAuditLogs } = require("../controllers/audit.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { permit } = require("../middlewares/role.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");

const router = express.Router();

router.use(authMiddleware, tenantMiddleware, permit("owner", "admin"));
router.get("/", listAuditLogs);

module.exports = router;
