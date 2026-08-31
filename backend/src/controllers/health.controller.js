const asyncHandler = require("../utils/asyncHandler");
const mongoose = require("mongoose");
const { validateEnvironment } = require("../config/env");
const { getWhatsAppProviderStatus } = require("../services/whatsapp-provider.service");
const { getMongoTransactionReadiness } = require("../utils/mongo-readiness");

const getHealth = asyncHandler(async (_req, res) => {
  const memory = process.memoryUsage();

  res.status(200).json({
    status: "ok",
    service: "billstack-backend",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    pid: process.pid,
    environment: process.env.NODE_ENV || "development",
    memory: {
      rssMb: Number((memory.rss / 1024 / 1024).toFixed(2)),
      heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
      heapTotalMb: Number((memory.heapTotal / 1024 / 1024).toFixed(2)),
    },
  });
});

const getReadiness = asyncHandler(async (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  const env = validateEnvironment({ throwOnError: false });
  const transactionReadiness = await getMongoTransactionReadiness();
  const ready = dbReady && env.ok;

  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    service: "billstack-backend",
    timestamp: new Date().toISOString(),
    checks: {
      api: {
        ready: true,
      },
      database: {
        ready: dbReady,
        state: mongoose.connection.readyState,
        topology: transactionReadiness.topology,
        transactionCapable: transactionReadiness.transactionCapable,
      },
      env: {
        ready: env.ok,
        missingRequiredCount: env.missing.length,
        warnings: env.warnings,
        productionFrontendOriginsConfigured: env.origins.frontend.length,
        productionBackendOriginsConfigured: env.origins.backend.length,
      },
      providers: {
        google: {
          enabled: env.features.googleLogin,
          configured: Boolean(process.env.GOOGLE_CLIENT_ID),
        },
        razorpay: {
          liveBillingEnabled: env.features.liveBilling,
          configured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET),
        },
        whatsapp: getWhatsAppProviderStatus(),
        email: { configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) },
      },
      worker: {
        reminderWorkerSupported: true,
        pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS || 30000),
        batchSize: Number(process.env.WORKER_BATCH_SIZE || 25),
      },
    },
  });
});

module.exports = {
  getHealth,
  getReadiness,
};
