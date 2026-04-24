const jwt = require("jsonwebtoken");

const getSuperAdminSecret = () =>
  process.env.SUPER_ADMIN_JWT_SECRET || process.env.JWT_SECRET || "super-admin-secret";

const signSuperAdminToken = (payload) =>
  jwt.sign(payload, getSuperAdminSecret(), { expiresIn: "12h" });

const verifySuperAdminToken = (token) => jwt.verify(token, getSuperAdminSecret());

module.exports = {
  signSuperAdminToken,
  verifySuperAdminToken,
};

