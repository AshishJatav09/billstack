const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const MessageDelivery = require("../src/models/MessageDelivery");
const ScheduledReminder = require("../src/models/ScheduledReminder");
const WebhookEvent = require("../src/models/WebhookEvent");
const { buildCorsOptions } = require("../src/config/cors");
const { validateEnvironment } = require("../src/config/env");
const { isAllowedImageSignature } = require("../src/config/upload");

const src = (...parts) => fs.readFileSync(path.join(__dirname, "..", "src", ...parts), "utf8");

const withEnv = (overrides, fn) => {
  const snapshot = { ...process.env };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return result.finally(() => {
        process.env = snapshot;
      });
    }
    process.env = snapshot;
    return result;
  } catch (error) {
    process.env = snapshot;
    throw error;
  }
};

test("production CORS allows only configured origins and rejects localhost", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      CLIENT_URL: "https://app.billstack.example",
      FRONTEND_ORIGINS: undefined,
      PRODUCTION_FRONTEND_ORIGINS: undefined,
    },
    async () => {
      const corsOptions = buildCorsOptions();

      await new Promise((resolve, reject) => {
        corsOptions.origin("https://app.billstack.example", (error, allowed) => {
          if (error) reject(error);
          else {
            assert.equal(allowed, true);
            resolve();
          }
        });
      });

      await assert.rejects(
        () =>
          new Promise((resolve, reject) => {
            corsOptions.origin("http://localhost:5173", (error, allowed) => {
              if (error) reject(error);
              else resolve(allowed);
            });
          }),
        /not allowed by CORS/
      );
    }
  );
});

test("production env validation fails fast for missing required core config", () => {
  withEnv(
    {
      NODE_ENV: "production",
      MONGO_URI: undefined,
      JWT_SECRET: undefined,
      CLIENT_URL: undefined,
      FRONTEND_ORIGINS: undefined,
      API_BASE_URL: undefined,
      BASE_URL: undefined,
    },
    () => {
      const result = validateEnvironment({ throwOnError: false });
      assert.equal(result.ok, false);
      assert.ok(result.missing.includes("MONGO_URI"));
      assert.ok(result.missing.includes("JWT_SECRET"));
      assert.ok(result.missing.includes("CLIENT_URL or FRONTEND_ORIGINS"));
      assert.ok(result.missing.includes("API_BASE_URL or BASE_URL"));
    }
  );
});

test("optional provider secrets are required only when their feature is enabled", () => {
  withEnv(
    {
      NODE_ENV: "production",
      MONGO_URI: "mongodb://localhost:27017/billstack-test",
      JWT_SECRET: "secret",
      CLIENT_URL: "https://app.billstack.example",
      API_BASE_URL: "https://api.billstack.example",
      WHATSAPP_SEND_ENABLED: "false",
      WHATSAPP_API_BASE_URL: undefined,
      WHATSAPP_API_TOKEN: undefined,
      WHATSAPP_ACCOUNT_ID: undefined,
    },
    () => {
      assert.equal(validateEnvironment({ throwOnError: false }).ok, true);
    }
  );

  withEnv(
    {
      NODE_ENV: "production",
      MONGO_URI: "mongodb://localhost:27017/billstack-test",
      JWT_SECRET: "secret",
      CLIENT_URL: "https://app.billstack.example",
      API_BASE_URL: "https://api.billstack.example",
      WHATSAPP_SEND_ENABLED: "true",
      WHATSAPP_API_BASE_URL: undefined,
      WHATSAPP_API_TOKEN: undefined,
      WHATSAPP_ACCOUNT_ID: undefined,
    },
    () => {
      const result = validateEnvironment({ throwOnError: false });
      assert.equal(result.ok, false);
      assert.ok(result.missing.includes("WHATSAPP_API_BASE_URL"));
      assert.ok(result.missing.includes("WHATSAPP_API_TOKEN"));
      assert.ok(result.missing.includes("WHATSAPP_ACCOUNT_ID"));
    }
  );
});

test("logo upload validation checks extension, MIME and magic bytes", () => {
  const upload = src("config", "upload.js");
  assert.match(upload, /allowedImages/);
  assert.match(upload, /validateUploadedLogo/);
  assert.match(upload, /crypto\.randomBytes/);

  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const fake = Buffer.from("not-an-image-file");
  assert.equal(isAllowedImageSignature(png, "image/png"), true);
  assert.equal(isAllowedImageSignature(jpg, "image/jpeg"), true);
  assert.equal(isAllowedImageSignature(fake, "image/png"), false);
});

test("reminder worker and model support atomic claiming and stale lock recovery", () => {
  const service = src("services", "communication.service.js");
  const worker = src("workers", "reminder-worker.js");
  const indexes = ScheduledReminder.schema.indexes().map(([fields]) => fields);

  assert.match(service, /ScheduledReminder\.findOneAndUpdate/);
  assert.match(service, /status: "PROCESSING"/);
  assert.match(service, /lockedAt/);
  assert.match(service, /lockedBy/);
  assert.match(service, /REMINDER_LOCK_TTL_MS/);
  assert.ok(indexes.some((fields) => fields.businessId === 1 && fields.status === 1 && fields.lockedAt === 1));
  assert.match(worker, /validateEnvironment/);
});

test("webhook events and message deliveries have idempotency and lookup indexes", () => {
  const webhookIndexes = WebhookEvent.schema.indexes();
  const deliveryIndexes = MessageDelivery.schema.indexes();
  const billing = src("controllers", "billing.controller.js");

  assert.ok(webhookIndexes.some(([fields, options]) => fields.provider === 1 && fields.eventId === 1 && options.unique));
  assert.ok(deliveryIndexes.some(([fields]) => fields.provider === 1 && fields.providerMessageId === 1));
  assert.match(billing, /Missing Razorpay webhook signature or event id/);
  assert.match(billing, /Duplicate webhook ignored/);
  assert.match(billing, /status = "FAILED"/);
});

test("health readiness and transaction diagnostics expose safe capability state without secrets", () => {
  const health = src("controllers", "health.controller.js");
  const diagnostics = src("scripts", "check-transactions.js");

  assert.match(health, /transactionCapable/);
  assert.match(health, /missingRequiredCount/);
  assert.doesNotMatch(health, /JWT_SECRET:/);
  assert.match(diagnostics, /getMongoTransactionReadiness/);
});

test("auth cookies remain httpOnly, secure in production and same-site by default", () => {
  const controller = src("controllers", "auth.controller.js");
  assert.match(controller, /httpOnly: true/);
  assert.match(controller, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(controller, /sameSite: "lax"/);
});

test("frontend sales lifecycle API helpers target mounted backend routes", () => {
  const api = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "features", "auth", "api.js"), "utf8");
  assert.match(api, /"\/sales\/credit-notes"/);
  assert.match(api, /"\/sales\/returns"/);
  assert.doesNotMatch(api, /sales-lifecycle/);
});
