const express = require("express");

const {
  createIntegrationCredential,
  ingestOrder,
  listIntegrationCredentials,
  listIntegrationEvents,
  revokeIntegrationCredential,
} = require("../controllers/integration.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const integrationAuthMiddleware = require("../middlewares/integration-auth.middleware");
const { permit } = require("../middlewares/role.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");

const router = express.Router();

router.post("/orders", integrationAuthMiddleware, ingestOrder);

router.use(authMiddleware, tenantMiddleware, permit("owner", "admin"));
router.get("/credentials", listIntegrationCredentials);
router.post("/credentials", createIntegrationCredential);
router.post("/credentials/:credentialId/revoke", revokeIntegrationCredential);
router.get("/events", listIntegrationEvents);

module.exports = router;
