const jwt = require("jsonwebtoken");

const getSuperAdminSecret = () => {
  const secret = process.env.SUPER_ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Super admin token secret is not configured");
  }
  return secret;
};

const signSuperAdminToken = (payload) =>
  jwt.sign(payload, getSuperAdminSecret(), { expiresIn: "12h" });

const verifySuperAdminToken = (token) => jwt.verify(token, getSuperAdminSecret());

module.exports = {
  signSuperAdminToken,
  verifySuperAdminToken,
};
