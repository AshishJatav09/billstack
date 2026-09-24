const rateLimit = require("express-rate-limit");

const retryAfterSeconds = (req) => Math.max(
  1,
  Math.ceil(((req.rateLimit?.resetTime?.getTime?.() || Date.now() + 60000) - Date.now()) / 1000)
);

const createAuthLimiter = ({ windowMs, max, message }) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = retryAfterSeconds(req);
    res.set("Retry-After", String(retryAfter));
    res.status(429).json({ message, retryAfter });
  },
});

const authRateLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  message: "Too many sign-in attempts. Please wait before trying again.",
});

const passwordRecoveryRateLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PASSWORD_RECOVERY_RATE_LIMIT_MAX || 5),
  message: "Too many password recovery requests. Please wait before trying again.",
});

const registrationRateLimiter = createAuthLimiter({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.REGISTRATION_RATE_LIMIT_MAX || 10),
  message: "Too many registration attempts. Please wait before trying again.",
});

const tokenRateLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.TOKEN_RATE_LIMIT_MAX || 120),
  message: "Too many session requests. Please wait before trying again.",
});

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many API requests. Please slow down and try again.",
  },
});

module.exports = {
  apiRateLimiter,
  authRateLimiter,
  passwordRecoveryRateLimiter,
  registrationRateLimiter,
  tokenRateLimiter,
};
