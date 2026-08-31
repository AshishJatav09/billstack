require("dotenv").config();

const connectDB = require("../config/db");
const { validateEnvironment } = require("../config/env");
const Business = require("../models/Business");
const { processDueReminders, processScheduledWorkflowDeliveries } = require("../services/communication.service");
const { processDueRecurringProfiles } = require("../services/workflow.service");
const { log } = require("../utils/logger");

const pollIntervalMs = Math.max(Number(process.env.WORKER_POLL_INTERVAL_MS || 30000), 5000);
const batchSize = Math.min(Number(process.env.WORKER_BATCH_SIZE || 25), 100);
let shuttingDown = false;
let running = false;

const tick = async () => {
  if (running || shuttingDown) return;
  running = true;
  try {
    const businesses = await Business.find({ isDisabled: { $ne: true } }).select("_id").limit(500);
    let processedCount = 0;
    for (const business of businesses) {
      const processed = await processDueReminders({ businessId: business._id, limit: batchSize });
      const workflowDeliveries = await processScheduledWorkflowDeliveries({ businessId: business._id, limit: batchSize });
      const recurringInvoices = await processDueRecurringProfiles({ businessId: business._id, now: new Date() });
      processedCount += processed.length;
      processedCount += workflowDeliveries.length;
      processedCount += recurringInvoices.length;
    }
    log("info", "Reminder worker tick completed", { processedCount, businesses: businesses.length });
  } catch (error) {
    log("error", "Reminder worker tick failed", { error: error.message });
  } finally {
    running = false;
  }
};

const shutdown = () => {
  shuttingDown = true;
  log("info", "Reminder worker shutting down");
  setTimeout(() => process.exit(0), 1000).unref();
};

const start = async () => {
  const env = validateEnvironment();
  for (const warning of env.warnings) {
    log("warn", "Reminder worker environment warning", { warning });
  }
  await connectDB();
  log("info", "Reminder worker started", { pollIntervalMs, batchSize });
  await tick();
  setInterval(tick, pollIntervalMs);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch((error) => {
  log("error", "Reminder worker failed to start", { error: error.message });
  process.exit(1);
});
