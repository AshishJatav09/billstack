const express = require("express");

const {
  createTeamMember,
  deleteTeamMember,
  listTeamMembers,
  updateTeamMember,
} = require("../controllers/team.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { validateObjectIdParam } = require("../middlewares/object-id.middleware");
const { permit } = require("../middlewares/role.middleware");
const { requireActiveSubscription } = require("../middlewares/subscription.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  teamMemberCreateValidator,
  teamMemberUpdateValidator,
} = require("../validators/resource.validation");

const router = express.Router();

router.use(authMiddleware, tenantMiddleware, requireActiveSubscription());

router.get("/", permit("owner", "admin"), listTeamMembers);
router.post("/", permit("owner", "admin"), validate(teamMemberCreateValidator), createTeamMember);
router.put(
  "/:userId",
  validateObjectIdParam("userId"),
  permit("owner", "admin"),
  validate(teamMemberUpdateValidator),
  updateTeamMember
);
router.delete("/:userId", validateObjectIdParam("userId"), permit("owner", "admin"), deleteTeamMember);

module.exports = router;
