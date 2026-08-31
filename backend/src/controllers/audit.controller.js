const AuditLog = require("../models/AuditLog");
const asyncHandler = require("../utils/asyncHandler");

const listAuditLogs = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const filters = { businessId: req.tenant.businessId };
  if (req.query.action) filters.action = String(req.query.action).toUpperCase();
  const rows = await AuditLog.find(filters).sort("-createdAt").limit(limit);
  res.json({ data: rows });
});

module.exports = { listAuditLogs };
