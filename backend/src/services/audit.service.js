const AuditLog = require("../models/AuditLog");
const { log } = require("../utils/logger");

const SENSITIVE_KEY_PATTERN = /(password|token|secret|credential|authorization|cookie|signature|otp|card|cvv|refresh)/i;

const sanitizeMetadata = (value, depth = 0) => {
  if (depth > 4) return "[Truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitizeMetadata(entry, depth + 1),
    ])
  );
};

const actorFromRequest = (req) => {
  if (req.integrationCredential) {
    return {
      type: "INTEGRATION",
      userId: req.integrationCredential.createdBy || null,
      email: "",
      role: req.integrationCredential.source || "integration",
    };
  }
  if (!req.user) return { type: "SYSTEM" };
  return {
    type: "USER",
    userId: req.user._id,
    email: req.user.email,
    role: req.user.role,
  };
};

const writeAuditLog = async ({ businessId, actor, action, entityType = "", entityId = null, req = null, metadata = {} }) => {
  try {
    return await AuditLog.create({
      businessId: businessId || req?.tenant?.businessId || req?.user?.businessId || null,
      actor: actor || actorFromRequest(req || {}),
      action,
      entity: { type: entityType, id: entityId || null },
      requestId: req?.requestId || "",
      ipAddress: req?.ip || "",
      userAgent: req?.headers?.["user-agent"] || "",
      metadata: sanitizeMetadata(metadata),
    });
  } catch (error) {
    log("error", "Audit log write failed", { action, error: error.message, requestId: req?.requestId });
    return null;
  }
};

module.exports = {
  sanitizeMetadata,
  writeAuditLog,
};
