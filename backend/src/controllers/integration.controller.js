const IntegrationEvent = require("../models/IntegrationEvent");
const asyncHandler = require("../utils/asyncHandler");
const { writeAuditLog } = require("../services/audit.service");
const {
  createCredential,
  ingestExternalOrder,
  listCredentials,
  revokeCredential,
} = require("../services/integration.service");

const listIntegrationCredentials = asyncHandler(async (req, res) => {
  res.json({ data: await listCredentials({ businessId: req.tenant.businessId }) });
});

const createIntegrationCredential = asyncHandler(async (req, res) => {
  const result = await createCredential({
    businessId: req.tenant.businessId,
    name: req.body.name || "External integration",
    source: req.body.source || "API",
    userId: req.user._id,
  });
  await writeAuditLog({ req, action: "INTEGRATION_CREDENTIAL_CREATED", entityType: "INTEGRATION_CREDENTIAL", entityId: result.credential._id, metadata: { source: result.credential.source } });
  res.status(201).json({ data: { credential: result.credential, apiKey: result.rawKey } });
});

const revokeIntegrationCredential = asyncHandler(async (req, res) => {
  const credential = await revokeCredential({
    businessId: req.tenant.businessId,
    credentialId: req.params.credentialId,
    userId: req.user._id,
  });
  await writeAuditLog({ req, action: "INTEGRATION_CREDENTIAL_REVOKED", entityType: "INTEGRATION_CREDENTIAL", entityId: credential._id, metadata: { source: credential.source } });
  res.json({ data: credential });
});

const ingestOrder = asyncHandler(async (req, res) => {
  const result = await ingestExternalOrder({ credential: req.integrationCredential, payload: req.body });
  await writeAuditLog({ req, businessId: req.integrationCredential.businessId, action: "INTEGRATION_ORDER_INGESTED", entityType: "INTEGRATION_EVENT", entityId: result.event._id, metadata: { source: result.event.source, externalOrderId: result.event.externalOrderId, idempotent: result.idempotent } });
  res.status(result.idempotent ? 200 : 201).json({ data: result });
});

const listIntegrationEvents = asyncHandler(async (req, res) => {
  res.json({
    data: await IntegrationEvent.find({ businessId: req.tenant.businessId })
      .populate("customerId", "name email phone")
      .populate("invoiceId", "invoiceNumber grandTotal")
      .sort("-createdAt")
      .limit(Math.min(Number(req.query.limit) || 100, 200)),
  });
});

module.exports = {
  createIntegrationCredential,
  ingestOrder,
  listIntegrationCredentials,
  listIntegrationEvents,
  revokeIntegrationCredential,
};
