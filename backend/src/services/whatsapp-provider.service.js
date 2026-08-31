const AppError = require("../utils/appError");
const crypto = require("crypto");

const getWhatsAppProviderStatus = () => ({
  configured: Boolean(process.env.WHATSAPP_API_BASE_URL && process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_ACCOUNT_ID),
  provider: process.env.WHATSAPP_PROVIDER_NAME || "BILLSTACK_WHATSAPP",
  accountId: process.env.WHATSAPP_ACCOUNT_ID || "",
  webhookConfigured: Boolean(process.env.WHATSAPP_WEBHOOK_SECRET),
  sendingEnabled: process.env.WHATSAPP_SEND_ENABLED === "true",
});

const buildWhatsAppPayload = ({ to, body, templateName, variables = {} }) => ({
  accountId: process.env.WHATSAPP_ACCOUNT_ID,
  to,
  type: templateName ? "template" : "text",
  templateName: templateName || undefined,
  variables,
  text: templateName ? undefined : { body },
});

const mapDeliveryStatus = (status) => {
  const value = String(status || "").toLowerCase();
  if (["sent", "submitted", "queued"].includes(value)) return "SENT";
  if (["delivered"].includes(value)) return "DELIVERED";
  if (["read"].includes(value)) return "READ";
  if (["failed", "undelivered", "rejected"].includes(value)) return "FAILED";
  return "SENT";
};

const verifyWhatsAppWebhookSignature = ({ rawBody = "", signature = "" }) => {
  if (!process.env.WHATSAPP_WEBHOOK_SECRET) return false;
  const expected = `sha256=${crypto.createHmac("sha256", process.env.WHATSAPP_WEBHOOK_SECRET).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const sendWhatsAppMessage = async ({ to, body, templateName, variables, sourceKey } = {}) => {
  const status = getWhatsAppProviderStatus();
  if (!status.configured) {
    throw new AppError("WhatsApp provider is not configured", 503);
  }
  if (!status.sendingEnabled) {
    throw new AppError("WhatsApp provider contract is not enabled", 501);
  }
  const response = await fetch(`${process.env.WHATSAPP_API_BASE_URL.replace(/\/$/, "")}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
      "Content-Type": "application/json",
      "Idempotency-Key": sourceKey || "",
    },
    body: JSON.stringify(buildWhatsAppPayload({ to, body, templateName, variables })),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new AppError(payload.message || "WhatsApp provider request failed", response.status);
  return {
    providerMessageId: payload.messageId || payload.id || "",
    providerReference: payload,
    status: mapDeliveryStatus(payload.status),
  };
};

module.exports = {
  buildWhatsAppPayload,
  getWhatsAppProviderStatus,
  mapDeliveryStatus,
  sendWhatsAppMessage,
  verifyWhatsAppWebhookSignature,
};
