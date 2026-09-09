require("../config/load-env")();

const mongoose = require("mongoose");

const connectDB = require("../config/db");
const { validateEnvironment } = require("../config/env");
const { getMongoTransactionReadiness } = require("../utils/mongo-readiness");

const run = async () => {
  validateEnvironment();
  await connectDB();

  const readiness = await getMongoTransactionReadiness();
  console.log(
    JSON.stringify(
      {
        connected: readiness.connected,
        transactionCapable: readiness.transactionCapable,
        topology: readiness.topology,
        replicaSetName: readiness.replicaSetName || "",
        primary: readiness.primary,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();

  if (!readiness.transactionCapable) {
    process.exit(1);
  }
};

run().catch(async (error) => {
  console.error(`MongoDB transaction readiness check failed: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
