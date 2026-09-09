const path = require("path");
const dotenv = require("dotenv");

const loadEnv = () =>
  dotenv.config({
    path: process.env.BILLSTACK_ENV_FILE || path.join(__dirname, "..", "..", ".env"),
  });

module.exports = loadEnv;
