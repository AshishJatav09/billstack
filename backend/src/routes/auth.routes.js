const express = require("express");

const {
  getMe,
  login,
  logout,
  refresh,
  register,
} = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  loginValidator,
  registerValidator,
} = require("../validators/auth.validation");
const { authRateLimiter } = require("../middlewares/rate-limit.middleware");

const router = express.Router();

router.post("/register", authRateLimiter, validate(registerValidator), register);
router.post("/login", authRateLimiter, validate(loginValidator), login);
router.post("/refresh", authRateLimiter, refresh);
router.post("/logout", logout);
router.get("/me", authMiddleware, tenantMiddleware, getMe);

module.exports = router;
