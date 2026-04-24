const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const RefreshToken = require("../models/RefreshToken");
const { ensureBusinessSubscription } = require("../utils/subscription");
const { serializeBusinessWithPlan } = require("../utils/businessPlan");

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_TOKEN_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7);

const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      businessId: user.businessId.toString(),
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );

const verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

const hashPassword = (password) => bcrypt.hash(password, 12);

const comparePassword = (password, hashedPassword) =>
  bcrypt.compare(password, hashedPassword);

const generateRefreshTokenValue = () => crypto.randomBytes(48).toString("hex");
const generateTokenFamilyId = () => crypto.randomUUID();

const issueRefreshToken = async (user, meta = {}) => {
  const token = generateRefreshTokenValue();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId: user._id,
    businessId: user.businessId,
    token,
    familyId: meta.familyId || generateTokenFamilyId(),
    expiresAt,
    replacedByToken: "",
    ipAddress: meta.ipAddress || "",
    userAgent: meta.userAgent || "",
  });

  return token;
};

const revokeRefreshToken = async (token, updates = {}) => {
  if (!token) {
    return;
  }

  await RefreshToken.findOneAndUpdate(
    { token },
    {
      isRevoked: true,
      revokedAt: new Date(),
      ...updates,
    }
  );
};

const findRefreshToken = async (token) => RefreshToken.findOne({ token });

const findValidRefreshToken = async (token) => {
  const tokenRecord = await findRefreshToken(token);

  if (!tokenRecord) {
    return null;
  }

  if (tokenRecord.isRevoked || tokenRecord.expiresAt <= new Date()) {
    return null;
  }

  return tokenRecord;
};

const revokeRefreshTokenFamily = async (familyId) => {
  if (!familyId) {
    return;
  }

  await RefreshToken.updateMany(
    { familyId, isRevoked: false },
    {
      isRevoked: true,
      revokedAt: new Date(),
    }
  );
};

const buildAuthPayload = async ({ user, business, accessToken }) => {
  const subscription = await ensureBusinessSubscription({
    businessId: business._id,
    planCode: business.planCode,
  });

  return ({
  accessToken,
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    businessId: user.businessId,
  },
  business: serializeBusinessWithPlan(business, subscription),
});
};

module.exports = {
  buildAuthPayload,
  comparePassword,
  findRefreshToken,
  findValidRefreshToken,
  generateTokenFamilyId,
  hashPassword,
  issueRefreshToken,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
  signAccessToken,
  verifyAccessToken,
};
