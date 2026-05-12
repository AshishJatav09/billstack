const asyncHandler = require("../utils/asyncHandler");

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

module.exports = {
  getHealth,
};
