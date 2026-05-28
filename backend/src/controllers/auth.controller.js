const Business = require("../models/Business");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const {
  buildAuthPayload,
  comparePassword,
  findRefreshToken,
  findValidRefreshToken,
  hashPassword,
  issueRefreshToken,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
  signAccessToken,
} = require("../services/auth.service");
const { serializeBusinessWithPlan } = require("../utils/businessPlan");

const refreshCookieName = process.env.REFRESH_COOKIE_NAME || "billstack_refresh_token";

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "workspace";

const buildUniqueBusinessSlug = async (businessName) => {
  const base = slugify(businessName);

  // Keep slug generation deterministic-ish but collision-safe.
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    const candidate = `${base}${suffix}`.slice(0, 48);
    // eslint-disable-next-line no-await-in-loop
    const exists = await Business.exists({ slug: candidate });
    if (!exists) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`.slice(0, 48);
};

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7) * 24 * 60 * 60 * 1000,
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password, businessName } = req.body;
  const slug = await buildUniqueBusinessSlug(businessName);

  const business = await Business.create({
    name: businessName.trim(),
    slug,
  });

  const existingUser = await User.findOne({
    businessId: business._id,
    email: email.trim().toLowerCase(),
  });

  if (existingUser) {
    throw new AppError("A user with this email already exists for the business", 409);
  }

  const hashedPassword = await hashPassword(password);
  const user = await User.create({
    businessId: business._id,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: hashedPassword,
    role: "owner",
  });

  business.ownerUserId = user._id;
  await business.save();

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.cookie(refreshCookieName, refreshToken, refreshCookieOptions);
  res.status(201).json({
    message: "Registration successful",
    data: await buildAuthPayload({ user, business, accessToken }),
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  const users = await User.find({ email: normalizedEmail }).limit(2);

  if (!users.length) {
    throw new AppError("Invalid credentials", 401);
  }

  if (users.length > 1) {
    throw new AppError("Multiple accounts found for this email. Please contact your admin.", 409);
  }

  const user = users[0];
  const business = await Business.findById(user.businessId);

  if (!business) {
    throw new AppError("Invalid credentials", 401);
  }

  if (!user.isActive) {
    throw new AppError("This user account has been deactivated", 403);
  }

  const passwordMatches = await comparePassword(password, user.password);

  if (!passwordMatches) {
    throw new AppError("Invalid credentials", 401);
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.cookie(refreshCookieName, refreshToken, refreshCookieOptions);
  res.status(200).json({
    message: "Login successful",
    data: await buildAuthPayload({ user, business, accessToken }),
  });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies[refreshCookieName];

  if (!refreshToken) {
    throw new AppError("Refresh token is required", 401);
  }

  const tokenRecord = await findRefreshToken(refreshToken);

  if (!tokenRecord) {
    throw new AppError("Refresh token is invalid or expired", 401);
  }

  if (tokenRecord.isRevoked) {
    await revokeRefreshTokenFamily(tokenRecord.familyId);
    res.clearCookie(refreshCookieName, refreshCookieOptions);
    throw new AppError("Refresh token reuse detected. Please sign in again.", 401);
  }

  if (tokenRecord.expiresAt <= new Date()) {
    await revokeRefreshToken(refreshToken);
    res.clearCookie(refreshCookieName, refreshCookieOptions);
    throw new AppError("Refresh token is invalid or expired", 401);
  }

  const validTokenRecord = await findValidRefreshToken(refreshToken);
  const user = await User.findById(validTokenRecord.userId);
  const business = await Business.findById(tokenRecord.businessId);

  if (!user || !business || user.businessId.toString() !== business._id.toString()) {
    throw new AppError("Refresh session is no longer valid", 401);
  }

  if (!user.isActive) {
    throw new AppError("This user account has been deactivated", 403);
  }

  const nextRefreshToken = await issueRefreshToken(user, {
    familyId: tokenRecord.familyId,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  await revokeRefreshToken(refreshToken, {
    replacedByToken: nextRefreshToken,
  });

  const nextAccessToken = signAccessToken(user);

  res.cookie(refreshCookieName, nextRefreshToken, refreshCookieOptions);
  res.status(200).json({
    message: "Token refreshed",
    data: await buildAuthPayload({ user, business, accessToken: nextAccessToken }),
  });
});

const getMe = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.user.businessId);

  if (!business || business._id.toString() !== req.tenant.businessId) {
    throw new AppError("Business context is invalid", 403);
  }

  res.status(200).json({
    message: "Current session",
    data: {
      user: req.user,
      business: serializeBusinessWithPlan(business, req.subscription),
    },
  });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies[refreshCookieName];
  await revokeRefreshToken(refreshToken);

  res.clearCookie(refreshCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  res.status(200).json({
    message: "Logged out successfully",
  });
});

module.exports = {
  getMe,
  login,
  logout,
  refresh,
  register,
};
