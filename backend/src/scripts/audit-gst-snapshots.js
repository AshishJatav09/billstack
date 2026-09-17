// Read-only: deliberately no apply/migration mode and no update/save operations.
const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const { auditGstSnapshot } = require("../utils/audit-gst-snapshot");
const run = async () => {
  if (!process.argv.includes("--dry-run")) throw new Error("Only --dry-run is supported. No historical invoices will be changed.");
  if (!process.env.MONGO_URI) throw new Error("Set MONGO_URI for the intended audit database before running.");
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const cursor = Invoice.find({ status: { $ne: "cancelled" } }).select("invoiceNumber gstSnapshot gstBreakup").lean().cursor();
    for await (const invoice of cursor) console.log(JSON.stringify(auditGstSnapshot(invoice)));
  } finally { await mongoose.disconnect(); }
};
run().catch(error => { console.error(error.message); process.exitCode = 1; });
