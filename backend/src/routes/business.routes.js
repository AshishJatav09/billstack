const express = require("express");

const {
  getCurrentBusiness,
  updateBusinessPlan,
  updateBusinessSetup,
} = require("../controllers/business.controller");
const { logoUpload } = require("../config/upload");
const authMiddleware = require("../middlewares/auth.middleware");
const { permit } = require("../middlewares/role.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  businessSetupValidator,
  planUpdateValidator,
} = require("../validators/auth.validation");

const router = express.Router();

router.use(authMiddleware, tenantMiddleware);

router.get("/me", getCurrentBusiness);
router.put(
  "/setup",
  permit("owner", "admin"),
  logoUpload.single("logo"),
  validate(businessSetupValidator),
  updateBusinessSetup
);
router.put("/plan", permit("owner"), validate(planUpdateValidator), updateBusinessPlan);

module.exports = router;

