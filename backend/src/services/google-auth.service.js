const AppError = require("../utils/appError");

const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

const verifyGoogleIdentityToken = async (idToken, expectedNonce = "") => {
  if (!idToken || typeof idToken !== "string") {
    throw new AppError("Google credential is required", 400);
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new AppError("Google login is not configured", 503);
  }
  const response = await fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) {
    throw new AppError("Google credential could not be verified", 401);
  }
  const payload = await response.json();
  if (payload.aud !== clientId) {
    throw new AppError("Google credential audience is invalid", 401);
  }
  if (payload.email_verified !== "true" && payload.email_verified !== true) {
    throw new AppError("Google email is not verified", 401);
  }
  if (!payload.sub || !payload.email) {
    throw new AppError("Google credential is missing required identity claims", 401);
  }
  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new AppError("Google credential nonce is invalid", 401);
  }
  return {
    subject: payload.sub,
    email: String(payload.email).trim().toLowerCase(),
    name: payload.name || payload.email.split("@")[0],
    picture: payload.picture || "",
    emailVerified: true,
  };
};

module.exports = {
  verifyGoogleIdentityToken,
};
