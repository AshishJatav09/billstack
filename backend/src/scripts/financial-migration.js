const mongoose = require("mongoose");
const { connectDatabase } = require("../config/database");
const { migrateBusiness, reconcileBusiness } = require("../services/financial-migration.service");

const businessId = process.env.BUSINESS_ID;
const dryRun = process.argv.includes("--dry-run");
if (!businessId) throw new Error("BUSINESS_ID is required.");
(async () => { await connectDatabase(); const migration = await migrateBusiness({ businessId, dryRun }); const reconciliation = dryRun ? null : await reconcileBusiness({ businessId }); console.log(JSON.stringify({ migration, reconciliation }, null, 2)); await mongoose.disconnect(); })().catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exit(1); });
