const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const AuditLog = require("../src/models/AuditLog");
const IntegrationCredential = require("../src/models/IntegrationCredential");
const IntegrationEvent = require("../src/models/IntegrationEvent");
const { sanitizeMetadata } = require("../src/services/audit.service");
const { hashValue } = require("../src/services/integration.service");
const {
  buildWhatsAppPayload,
  getWhatsAppProviderStatus,
  mapDeliveryStatus,
  verifyWhatsAppWebhookSignature,
} = require("../src/services/whatsapp-provider.service");

test("audit logs are tenant scoped, immutable and redact sensitive metadata", () => {
  const indexes = AuditLog.schema.indexes().map(([fields]) => fields);
  assert.ok(indexes.some((fields) => fields.businessId === 1 && fields.createdAt === -1));
  assert.equal(AuditLog.schema.path("action").options.immutable, true);

  const metadata = sanitizeMetadata({
    email: "owner@example.com",
    password: "secret",
    nested: { accessToken: "abc", safe: "yes" },
  });
  assert.equal(metadata.password, "[REDACTED]");
  assert.equal(metadata.nested.accessToken, "[REDACTED]");
  assert.equal(metadata.nested.safe, "yes");
});

test("integration credentials store only hashes and integration events enforce idempotency indexes", () => {
  const credentialIndexes = IntegrationCredential.schema.indexes().map(([fields]) => fields);
  const eventIndexes = IntegrationEvent.schema.indexes().map(([fields]) => fields);
  assert.ok(credentialIndexes.some((fields) => fields.businessId === 1 && fields.keyPrefix === 1));
  assert.ok(eventIndexes.some((fields) => fields.businessId === 1 && fields.source === 1 && fields.externalOrderId === 1));
  assert.equal(IntegrationCredential.schema.path("keyHash").options.immutable, true);
  assert.equal(hashValue("sample").length, 64);
});

test("WhatsApp provider boundary maps payloads, status and webhook signatures without faking sends", () => {
  const oldSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  process.env.WHATSAPP_WEBHOOK_SECRET = "test-secret";
  const rawBody = JSON.stringify({ messageId: "wamid-1", status: "delivered" });
  const signature = `sha256=${crypto.createHmac("sha256", "test-secret").update(rawBody).digest("hex")}`;

  assert.equal(verifyWhatsAppWebhookSignature({ rawBody, signature }), true);
  assert.equal(verifyWhatsAppWebhookSignature({ rawBody, signature: "bad" }), false);
  assert.equal(mapDeliveryStatus("read"), "READ");
  assert.equal(mapDeliveryStatus("failed"), "FAILED");

  const payload = buildWhatsAppPayload({ to: "+919999999999", body: "Hello" });
  assert.equal(payload.type, "text");
  assert.equal(payload.text.body, "Hello");
  assert.equal(typeof getWhatsAppProviderStatus().configured, "boolean");

  if (oldSecret) process.env.WHATSAPP_WEBHOOK_SECRET = oldSecret;
  else delete process.env.WHATSAPP_WEBHOOK_SECRET;
});
