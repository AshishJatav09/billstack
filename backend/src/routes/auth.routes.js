const express = require("express");

const {
  forgotPassword,
  getMe,
  login,
  logout,
  refresh,
  register,
  resetPassword,
} = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  forgotPasswordValidator,
  loginValidator,
  registerValidator,
  resetPasswordValidator,
} = require("../validators/auth.validation");
const { authRateLimiter } = require("../middlewares/rate-limit.middleware");

const router = express.Router();

router.post("/register", authRateLimiter, validate(registerValidator), register);
router.post("/login", authRateLimiter, validate(loginValidator), login);
router.post("/forgot-password", authRateLimiter, validate(forgotPasswordValidator), forgotPassword);
router.post("/reset-password", authRateLimiter, validate(resetPasswordValidator), resetPassword);
router.post("/refresh", authRateLimiter, refresh);
router.post("/logout", logout);
router.get("/me", authMiddleware, tenantMiddleware, getMe);

module.exports = router;
