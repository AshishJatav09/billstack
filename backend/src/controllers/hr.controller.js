const asyncHandler = require("../utils/asyncHandler");
const {
  createEmployee,
  createHoliday,
  deactivateEmployee,
  getDailyAttendance,
  getEmployeeById,
  getMonthlyAttendanceSummary,
  getMonthlyTeamAttendance,
  getSalaryStructuresByEmployee,
  listEmployeeOptions,
  listEmployees,
  listSalaryStructures,
  markAttendance,
  updateAttendanceById,
  updateEmployee,
  upsertSalaryStructure,
} = require("../services/hr.service");

const listEmployeesController = asyncHandler(async (req, res) => {
  const data = await listEmployees({
    businessId: req.tenant.businessId,
    query: req.query,
  });

  res.status(200).json({
    message: "Employees fetched successfully",
    data,
  });
});

const listEmployeeOptionsController = asyncHandler(async (req, res) => {
  const data = await listEmployeeOptions({
    businessId: req.tenant.businessId,
    status: req.query.status || "",
  });

  res.status(200).json({
    message: "Employee options fetched successfully",
    data,
  });
});

const getEmployeeByIdController = asyncHandler(async (req, res) => {
  const data = await getEmployeeById({
    businessId: req.tenant.businessId,
    employeeId: req.params.employeeId,
  });

  res.status(200).json({
    message: "Employee fetched successfully",
    data,
  });
});

const createEmployeeController = asyncHandler(async (req, res) => {
  const data = await createEmployee({
    businessId: req.tenant.businessId,
    payload: req.body,
    userId: req.user._id,
  });

  res.status(201).json({
    message: "Employee created successfully",
    data,
  });
});

const updateEmployeeController = asyncHandler(async (req, res) => {
  const data = await updateEmployee({
    businessId: req.tenant.businessId,
    employeeId: req.params.employeeId,
    payload: req.body,
    userId: req.user._id,
  });

  res.status(200).json({
    message: "Employee updated successfully",
    data,
  });
});

const deactivateEmployeeController = asyncHandler(async (req, res) => {
  const data = await deactivateEmployee({
    businessId: req.tenant.businessId,
    employeeId: req.params.employeeId,
    userId: req.user._id,
  });

  res.status(200).json({
    message: "Employee marked inactive successfully",
    data,
  });
});

const getAttendanceByDateController = asyncHandler(async (req, res) => {
  const data = await getDailyAttendance({
    businessId: req.tenant.businessId,
    date: req.query.date || new Date().toISOString(),
  });

  res.status(200).json({
    message: "Attendance fetched successfully",
    data,
  });
});

const getMonthlyAttendanceSummaryController = asyncHandler(async (req, res) => {
  const data = await getMonthlyAttendanceSummary({
    businessId: req.tenant.businessId,
    month: req.query.month,
  });

  res.status(200).json({
    message: "Attendance summary fetched successfully",
    data,
  });
});

const getMonthlyTeamAttendanceController = asyncHandler(async (req, res) => {
  const data = await getMonthlyTeamAttendance({
    businessId: req.tenant.businessId,
    month: req.query.month,
  });

  res.status(200).json({
    message: "Monthly team attendance fetched successfully",
    data,
  });
});

const markAttendanceController = asyncHandler(async (req, res) => {
  const data = await markAttendance({
    businessId: req.tenant.businessId,
    payload: req.body,
    userId: req.user._id,
  });

  res.status(200).json({
    message: "Attendance marked successfully",
    data,
  });
});

const createHolidayController = asyncHandler(async (req, res) => {
  const data = await createHoliday({
    businessId: req.tenant.businessId,
    payload: req.body,
    userId: req.user._id,
  });

  res.status(201).json({
    message: "Holiday saved successfully",
    data,
  });
});

const updateAttendanceController = asyncHandler(async (req, res) => {
  const data = await updateAttendanceById({
    businessId: req.tenant.businessId,
    attendanceId: req.params.attendanceId,
    payload: req.body,
    userId: req.user._id,
  });

  res.status(200).json({
    message: "Attendance updated successfully",
    data,
  });
});

const listSalaryStructuresController = asyncHandler(async (req, res) => {
  const data = await listSalaryStructures({
    businessId: req.tenant.businessId,
    query: req.query,
  });

  res.status(200).json({
    message: "Salary structures fetched successfully",
    data,
  });
});

const getSalaryStructuresByEmployeeController = asyncHandler(async (req, res) => {
  const data = await getSalaryStructuresByEmployee({
    businessId: req.tenant.businessId,
    employeeId: req.params.employeeId,
  });

  res.status(200).json({
    message: "Employee salary structures fetched successfully",
    data,
  });
});

const createSalaryStructureController = asyncHandler(async (req, res) => {
  const data = await upsertSalaryStructure({
    businessId: req.tenant.businessId,
    employeeId: req.body.employeeId,
    payload: req.body,
  });

  res.status(201).json({
    message: "Salary structure saved successfully",
    data,
  });
});

const updateSalaryStructureController = asyncHandler(async (req, res) => {
  const data = await upsertSalaryStructure({
    businessId: req.tenant.businessId,
    employeeId: req.body.employeeId,
    payload: req.body,
    structureId: req.params.salaryStructureId,
  });

  res.status(200).json({
    message: "Salary structure updated successfully",
    data,
  });
});

module.exports = {
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
};
