const dotenv = require("dotenv");

dotenv.config();

const app = require("./app");
const connectDB = require("./config/db");
const { log } = require("./utils/logger");

const PORT = process.env.PORT || 5000;
let server;

const startServer = async () => {
  try {
    await connectDB();
    server = app.listen(PORT, () => {
      log("info", `BillStack API running on port ${PORT}`);
    });
  } catch (error) {
    log("error", "Failed to start server", { message: error.message });
    process.exit(1);
  }
};

const shutdown = (signal) => {
  log("info", `Received ${signal}. Shutting down BillStack API.`);

  if (!server) {
    process.exit(0);
    return;
  }

  server.close(() => {
    log("info", "HTTP server closed successfully");
    process.exit(0);
  });

  setTimeout(() => {
    log("error", "Forced shutdown after timeout");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (error) => {
  log("error", "Uncaught exception", { message: error.message, stack: error.stack });
});
process.on("unhandledRejection", (reason) => {
  log("error", "Unhandled promise rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});

startServer();
