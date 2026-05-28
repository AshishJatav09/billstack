const mongoose = require("mongoose");

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const salaryTypes = ["monthly", "daily", "commission", "mixed"];
const commissionTypes = ["percentage", "fixed", "none"];
const attendanceStatuses = ["present", "absent", "half_day", "leave", "late"];

const ensureValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const isValidNumber = (value) => value !== "" && value !== null && value !== undefined && !Number.isNaN(Number(value));

const employeeCreateValidator = (body) => {
  const errors = {};

  if (!body.name || body.name.trim().length < 2) {
    errors.name = "Employee name must be at least 2 characters";
  }

  if (!body.phone && !body.email) {
    errors.contact = "Phone or email is required";
  }

  if (body.email && !isEmail(body.email)) {
    errors.email = "Employee email must be valid";
  }

  if (!body.role || body.role.trim().length < 2) {
    errors.role = "Role is required";
  }

  if (!body.joiningDate || Number.isNaN(Date.parse(body.joiningDate))) {
    errors.joiningDate = "Joining date is required";
  }

  if (!body.salaryType || !salaryTypes.includes(body.salaryType)) {
    errors.salaryType = "Salary type is invalid";
  }

  ["baseSalary", "dailyWage", "commissionValue"].forEach((field) => {
    if (body[field] !== undefined && body[field] !== "" && !isValidNumber(body[field])) {
      errors[field] = `${field} must be a valid number`;
    }
  });

  if (body.commissionType && !commissionTypes.includes(body.commissionType)) {
    errors.commissionType = "Commission type is invalid";
  }

  if (body.status && !["active", "inactive"].includes(body.status)) {
    errors.status = "Status must be active or inactive";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const employeeUpdateValidator = employeeCreateValidator;

const attendanceMarkValidator = (body) => {
  const errors = {};
  const records = Array.isArray(body.records) ? body.records : [body];

  if (!records.length) {
    errors.records = "At least one attendance record is required";
  }

  records.forEach((record, index) => {
    const prefix = Array.isArray(body.records) ? `records.${index}` : "";
    const key = (field) => (prefix ? `${prefix}.${field}` : field);

    if (!record.employeeId || !ensureValidObjectId(record.employeeId)) {
      errors[key("employeeId")] = "Employee is required";
    }

    if (!record.date || Number.isNaN(Date.parse(record.date))) {
      errors[key("date")] = "Date is required";
    }

    if (!record.status || !attendanceStatuses.includes(record.status)) {
      errors[key("status")] = "Attendance status is invalid";
    }

    if (record.overtimeHours !== undefined && record.overtimeHours !== "" && !isValidNumber(record.overtimeHours)) {
      errors[key("overtimeHours")] = "Overtime hours must be valid";
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const attendanceUpdateValidator = attendanceMarkValidator;

const salaryStructureCreateValidator = (body) => {
  const errors = {};

  if (!body.employeeId || !ensureValidObjectId(body.employeeId)) {
    errors.employeeId = "Employee is required";
  }

  if (!body.salaryType || !salaryTypes.includes(body.salaryType)) {
    errors.salaryType = "Salary type is invalid";
  }

  if (!body.effectiveFrom || Number.isNaN(Date.parse(body.effectiveFrom))) {
    errors.effectiveFrom = "Effective from date is required";
  }

  if (body.effectiveTo && Number.isNaN(Date.parse(body.effectiveTo))) {
    errors.effectiveTo = "Effective to date is invalid";
  }

  ["baseSalary", "dailyWage", "commissionValue"].forEach((field) => {
    if (body[field] !== undefined && body[field] !== "" && !isValidNumber(body[field])) {
      errors[field] = `${field} must be a valid number`;
    }
  });

  if (body.commissionType && !commissionTypes.includes(body.commissionType)) {
    errors.commissionType = "Commission type is invalid";
  }

  if (body.status && !["active", "inactive"].includes(body.status)) {
    errors.status = "Status must be active or inactive";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

const salaryStructureUpdateValidator = salaryStructureCreateValidator;

module.exports = {
  attendanceMarkValidator,
  attendanceUpdateValidator,
  employeeCreateValidator,
  employeeUpdateValidator,
  salaryStructureCreateValidator,
  salaryStructureUpdateValidator,
};
