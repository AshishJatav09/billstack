const mongoose = require("mongoose");

const getMongoTransactionReadiness = async () => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return {
      connected: false,
      transactionCapable: false,
      topology: "disconnected",
    };
  }

  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    const transactionCapable = Boolean(hello.setName || hello.msg === "isdbgrid");

    return {
      connected: true,
      transactionCapable,
      topology: hello.msg === "isdbgrid" ? "sharded" : hello.setName ? "replica_set" : "standalone",
      replicaSetName: hello.setName || "",
      primary: Boolean(hello.isWritablePrimary || hello.ismaster),
    };
  } catch (error) {
    return {
      connected: true,
      transactionCapable: false,
      topology: "unknown",
      error: error.message,
    };
  }
};

module.exports = {
  getMongoTransactionReadiness,
};
