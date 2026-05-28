const express = require("express");

const authMiddleware = require("../middlewares/auth.middleware");
const { requireHRManageAccess, requireHRViewAccess } = require("../middlewares/hr-permission.middleware");
const { validateObjectIdParam } = require("../middlewares/object-id.middleware");
const { requireActiveSubscription } = require("../middlewares/subscription.middleware");
const tenantMiddleware = require("../middlewares/tenant.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  attendanceMarkValidator,
  attendanceUpdateValidator,
  employeeCreateValidator,
  employeeUpdateValidator,
  salaryStructureCreateValidator,
  salaryStructureUpdateValidator,
} = require("../validators/hr.validation");
const {
  createEmployeeController,
  createHolidayController,
  createSalaryStructureController,
  deactivateEmployeeController,
  getAttendanceByDateController,
  getEmployeeByIdController,
  getMonthlyAttendanceSummaryController,
  getMonthlyTeamAttendanceController,
  getSalaryStructuresByEmployeeController,
  listEmployeeOptionsController,
  listEmployeesController,
  listSalaryStructuresController,
  markAttendanceController,
  updateAttendanceController,
  updateEmployeeController,
  updateSalaryStructureController,
} = require("../controllers/hr.controller");

const router = express.Router();

router.use(authMiddleware, tenantMiddleware, requireActiveSubscription());

router.get("/employees/options", requireHRViewAccess, listEmployeeOptionsController);
router.get("/employees", requireHRViewAccess, listEmployeesController);
router.get("/employees/:employeeId", requireHRViewAccess, validateObjectIdParam("employeeId"), getEmployeeByIdController);
router.post("/employees", requireHRManageAccess, validate(employeeCreateValidator), createEmployeeController);
router.put(
  "/employees/:employeeId",
  requireHRManageAccess,
  validateObjectIdParam("employeeId"),
  validate(employeeUpdateValidator),
  updateEmployeeController
);
router.delete("/employees/:employeeId", requireHRManageAccess, validateObjectIdParam("employeeId"), deactivateEmployeeController);

router.get("/attendance/monthly-summary", requireHRViewAccess, getMonthlyAttendanceSummaryController);
router.get("/attendance/monthly-team", requireHRViewAccess, getMonthlyTeamAttendanceController);
router.get("/attendance", requireHRViewAccess, getAttendanceByDateController);
router.post("/attendance/mark", requireHRManageAccess, validate(attendanceMarkValidator), markAttendanceController);
router.post("/attendance/holidays", requireHRManageAccess, createHolidayController);
router.put(
  "/attendance/:attendanceId",
  requireHRManageAccess,
  validateObjectIdParam("attendanceId"),
  validate(attendanceUpdateValidator),
  updateAttendanceController
);

router.get("/salary-structures", requireHRViewAccess, listSalaryStructuresController);
router.get(
  "/salary-structures/:employeeId",
  requireHRViewAccess,
  validateObjectIdParam("employeeId"),
  getSalaryStructuresByEmployeeController
);
router.post(
  "/salary-structures",
  requireHRManageAccess,
  validate(salaryStructureCreateValidator),
  createSalaryStructureController
);
router.put(
  "/salary-structures/:salaryStructureId",
  requireHRManageAccess,
  validateObjectIdParam("salaryStructureId"),
  validate(salaryStructureUpdateValidator),
  updateSalaryStructureController
);

module.exports = router;
