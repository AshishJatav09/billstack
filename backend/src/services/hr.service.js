const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const SalaryStructure = require("../models/SalaryStructure");
const Holiday = require("../models/Holiday");
const AppError = require("../utils/appError");
const {
  buildPaginatedResponse,
  buildPagination,
  buildSearchFilter,
  buildSort,
} = require("../utils/queryFeatures");

const employeeSortFields = ["name", "employeeCode", "role", "department", "joiningDate", "createdAt", "updatedAt"];
const salarySortFields = ["effectiveFrom", "createdAt", "updatedAt"];
const attendanceValueMap = {
  present: 1,
  late: 1,
  half_day: 0.5,
  leave: 0,
  absent: 0,
};

const normalizeDateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError("Invalid date value", 400);
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const buildNextEmployeeCode = async (businessId) => {
  const count = await Employee.countDocuments({ businessId });
  let candidateNumber = count + 1;

  while (true) {
    const candidate = `EMP-${String(candidateNumber).padStart(4, "0")}`;
    const exists = await Employee.exists({ businessId, employeeCode: candidate });

    if (!exists) {
      return candidate;
    }

    candidateNumber += 1;
  }
};

const createHoliday = async ({ businessId, payload, userId }) => {
  const date = normalizeDateOnly(payload.date);
  const name = payload.name?.trim() || "";

  const existing = await Holiday.findOne({ businessId, date });
  if (existing) {
    existing.name = name;
    existing.createdBy = userId;
    await existing.save();
    return existing;
  }

  return Holiday.create({
    businessId,
    date,
    name,
    createdBy: userId,
  });
};

const ensureEmployeeBelongsToBusiness = async (businessId, employeeId) => {
  const employee = await Employee.findOne({ _id: employeeId, businessId });

  if (!employee) {
    throw new AppError("Employee not found", 404);
  }

  return employee;
};

const sanitizeEmployeePayload = async ({ businessId, payload, userId, currentEmployee = null }) => {
  const employeeCode = (payload.employeeCode || currentEmployee?.employeeCode || "").trim().toUpperCase();
  const nextEmployeeCode = employeeCode || (await buildNextEmployeeCode(businessId));

  const duplicateCode = await Employee.findOne({
    businessId,
    employeeCode: nextEmployeeCode,
    _id: currentEmployee?._id ? { $ne: currentEmployee._id } : { $exists: true },
  });

  if (duplicateCode) {
    throw new AppError("Employee code already exists for this business", 409);
  }

  return {
    businessId,
    employeeCode: nextEmployeeCode,
    name: payload.name.trim(),
    phone: payload.phone?.trim() || "",
    email: payload.email?.trim().toLowerCase() || "",
    role: payload.role.trim(),
    department: payload.department?.trim() || "",
    joiningDate: normalizeDateOnly(payload.joiningDate),
    salaryType: payload.salaryType,
    baseSalary: Number(payload.baseSalary || 0),
    dailyWage: Number(payload.dailyWage || 0),
    commissionEnabled: Boolean(payload.commissionEnabled),
    commissionType: payload.commissionType || "none",
    commissionValue: Number(payload.commissionValue || 0),
    status: payload.status || currentEmployee?.status || "active",
    notes: payload.notes?.trim() || "",
    createdBy: currentEmployee?.createdBy || userId,
    updatedBy: userId,
  };
};

const createEmployee = async ({ businessId, payload, userId }) => {
  const employeePayload = await sanitizeEmployeePayload({ businessId, payload, userId });
  return Employee.create(employeePayload);
};

const updateEmployee = async ({ businessId, employeeId, payload, userId }) => {
  const employee = await ensureEmployeeBelongsToBusiness(businessId, employeeId);
  const nextPayload = await sanitizeEmployeePayload({
    businessId,
    payload: { ...employee.toObject(), ...payload },
    userId,
    currentEmployee: employee,
  });

  Object.assign(employee, nextPayload);
  await employee.save();
  return employee;
};

const listEmployees = async ({ businessId, query = {} }) => {
  const { page, limit, skip } = buildPagination(query);
  const sort = buildSort(query.sortBy, query.sortOrder, employeeSortFields);
  const searchFilter = buildSearchFilter(query.search, ["name", "phone", "email", "role", "department", "employeeCode"]);

  const filters = {
    businessId,
    ...searchFilter,
  };

  if (query.status) {
    filters.status = query.status;
  }

  if (query.department) {
    filters.department = query.department.trim();
  }

  const [items, total] = await Promise.all([
    Employee.find(filters).sort(sort).skip(skip).limit(limit),
    Employee.countDocuments(filters),
  ]);

  return buildPaginatedResponse({ items, total, page, limit });
};

const listEmployeeOptions = async ({ businessId, status = "active" }) =>
  Employee.find({ businessId, ...(status ? { status } : {}) })
    .sort("name")
    .select("employeeCode name role department salaryType status");

const getEmployeeById = ({ businessId, employeeId }) => ensureEmployeeBelongsToBusiness(businessId, employeeId);

const deactivateEmployee = async ({ businessId, employeeId, userId }) => {
  const employee = await ensureEmployeeBelongsToBusiness(businessId, employeeId);
  employee.status = "inactive";
  employee.updatedBy = userId;
  await employee.save();
  return employee;
};

const markAttendance = async ({ businessId, payload, userId }) => {
  const records = Array.isArray(payload.records) ? payload.records : [payload];
  const employeeIds = [...new Set(records.map((record) => record.employeeId))];
  const existingEmployees = await Employee.find({
    businessId,
    _id: { $in: employeeIds },
  }).select("_id");

  const allowedEmployeeIds = new Set(existingEmployees.map((employee) => employee._id.toString()));

  for (const record of records) {
    if (!allowedEmployeeIds.has(String(record.employeeId))) {
      throw new AppError("One or more employees do not belong to this business", 404);
    }
  }

  const writes = records.map((record) => ({
    updateOne: {
      filter: {
        businessId,
        employeeId: new mongoose.Types.ObjectId(record.employeeId),
        date: normalizeDateOnly(record.date),
      },
      update: {
        $set: {
          businessId,
          employeeId: new mongoose.Types.ObjectId(record.employeeId),
          date: normalizeDateOnly(record.date),
          status: record.status,
          checkIn: record.checkIn?.trim() || "",
          checkOut: record.checkOut?.trim() || "",
          overtimeHours: Number(record.overtimeHours || 0),
          notes: record.notes?.trim() || "",
          markedBy: userId,
        },
      },
      upsert: true,
    },
  }));

  if (writes.length) {
    await Attendance.bulkWrite(writes);
  }

  const targetDate = normalizeDateOnly(records[0].date);
  return getDailyAttendance({ businessId, date: targetDate.toISOString() });
};

const updateAttendanceById = async ({ businessId, attendanceId, payload, userId }) => {
  const attendance = await Attendance.findOne({ _id: attendanceId, businessId });

  if (!attendance) {
    throw new AppError("Attendance record not found", 404);
  }

  await ensureEmployeeBelongsToBusiness(businessId, payload.employeeId || attendance.employeeId);

  attendance.employeeId = payload.employeeId || attendance.employeeId;
  attendance.date = payload.date ? normalizeDateOnly(payload.date) : attendance.date;
  attendance.status = payload.status || attendance.status;
  attendance.checkIn = payload.checkIn?.trim() || "";
  attendance.checkOut = payload.checkOut?.trim() || "";
  attendance.overtimeHours = Number(payload.overtimeHours || 0);
  attendance.notes = payload.notes?.trim() || "";
  attendance.markedBy = userId;
  await attendance.save();

  return attendance.populate("employeeId", "employeeCode name role department status");
};

const getDailyAttendance = async ({ businessId, date }) => {
  const selectedDate = normalizeDateOnly(date);
  const [employees, attendanceRecords] = await Promise.all([
    Employee.find({ businessId }).sort("name"),
    Attendance.find({ businessId, date: selectedDate }).sort("createdAt"),
  ]);

  const attendanceMap = new Map(
    attendanceRecords.map((record) => [record.employeeId.toString(), record])
  );

  return {
    date: selectedDate,
    items: employees.map((employee) => {
      const attendance = attendanceMap.get(employee._id.toString());

      return {
        employee,
        attendance: attendance || null,
      };
    }),
  };
};

const getMonthlyAttendanceSummary = async ({ businessId, month }) => {
  const [year, monthNumber] = String(month || "").split("-").map(Number);

  if (!year || !monthNumber) {
    throw new AppError("Month must be in YYYY-MM format", 400);
  }

  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));

  const summary = await Attendance.aggregate([
    {
      $match: {
        businessId: new mongoose.Types.ObjectId(businessId),
        date: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: "$employeeId",
        presentDays: {
          $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
        },
        absentDays: {
          $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
        },
        halfDays: {
          $sum: { $cond: [{ $eq: ["$status", "half_day"] }, 1, 0] },
        },
        leaveDays: {
          $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] },
        },
        lateDays: {
          $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] },
        },
        overtimeHours: {
          $sum: "$overtimeHours",
        },
        payableDays: {
          $sum: {
            $switch: {
              branches: [
                { case: { $eq: ["$status", "present"] }, then: attendanceValueMap.present },
                { case: { $eq: ["$status", "late"] }, then: attendanceValueMap.late },
                { case: { $eq: ["$status", "half_day"] }, then: attendanceValueMap.half_day },
                { case: { $eq: ["$status", "leave"] }, then: attendanceValueMap.leave },
              ],
              default: 0,
            },
          },
        },
      },
    },
  ]);

  const employees = await Employee.find({ businessId }).sort("name").select("employeeCode name role department status");
  const summaryMap = new Map(summary.map((item) => [item._id.toString(), item]));

  return employees.map((employee) => {
    const employeeSummary = summaryMap.get(employee._id.toString());

    return {
      employee,
      presentDays: employeeSummary?.presentDays || 0,
      absentDays: employeeSummary?.absentDays || 0,
      halfDays: employeeSummary?.halfDays || 0,
      leaveDays: employeeSummary?.leaveDays || 0,
      lateDays: employeeSummary?.lateDays || 0,
      overtimeHours: employeeSummary?.overtimeHours || 0,
      payableDays: employeeSummary?.payableDays || 0,
    };
  });
};

const getMonthlyTeamAttendance = async ({ businessId, month }) => {
  const [year, monthNumber] = String(month || "").split("-").map(Number);

  if (!year || !monthNumber) {
    throw new AppError("Month must be in YYYY-MM format", 400);
  }

  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  const [employees, attendanceRecords, holidays] = await Promise.all([
    Employee.find({ businessId }).sort("name").select("employeeCode name role department status email"),
    Attendance.find({ businessId, date: { $gte: start, $lt: end } })
      .sort("date")
      .populate("employeeId", "employeeCode name role department status email"),
    Holiday.find({ businessId, date: { $gte: start, $lt: end } }).sort("date"),
  ]);

  const holidayMap = new Map(holidays.map((holiday) => [holiday.date.toISOString().slice(0, 10), holiday]));

  const attendanceByEmployee = new Map();
  const distinctMarkedDates = new Set();
  const totals = {
    present: 0,
    absent: 0,
    halfDay: 0,
    leave: 0,
    late: 0,
  };

  attendanceRecords.forEach((record) => {
    const employeeKey = record.employeeId?._id?.toString() || record.employeeId.toString();
    if (!attendanceByEmployee.has(employeeKey)) {
      attendanceByEmployee.set(employeeKey, new Map());
    }

    const dateKey = record.date.toISOString().slice(0, 10);
    attendanceByEmployee.get(employeeKey).set(dateKey, record);
    distinctMarkedDates.add(dateKey);

    if (record.status === "present") totals.present += 1;
    if (record.status === "absent") totals.absent += 1;
    if (record.status === "half_day") totals.halfDay += 1;
    if (record.status === "leave") totals.leave += 1;
    if (record.status === "late") totals.late += 1;
  });

  const buildDayStatus = ({ date, record }) => {
    if (record) {
      return {
        date,
        status: record.status,
        attendanceId: record._id,
      };
    }

    const holiday = holidayMap.get(date);
    if (holiday) {
      return {
        date,
        status: "holiday",
        attendanceId: "",
        holidayId: holiday._id,
        holidayName: holiday.name || "",
      };
    }

    const day = new Date(`${date}T00:00:00.000Z`);
    const dayOfWeek = day.getUTCDay(); // 0 Sunday
    const isWeekend = dayOfWeek === 0;

    return {
      date,
      status: isWeekend ? "weekend_off" : "not_marked",
      attendanceId: "",
    };
  };

  const items = employees.map((employee) => {
    const employeeKey = employee._id.toString();
    const recordMap = attendanceByEmployee.get(employeeKey) || new Map();
    const counts = {
      present: 0,
      absent: 0,
      halfDay: 0,
      leave: 0,
      late: 0,
      weekendOff: 0,
      holiday: 0,
      notMarked: 0,
      marked: 0,
    };

    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const dayNumber = index + 1;
      const date = new Date(Date.UTC(year, monthNumber - 1, dayNumber)).toISOString().slice(0, 10);
      const record = recordMap.get(date);
      const dayStatus = buildDayStatus({ date, record });

      if (dayStatus.status === "present") counts.present += 1;
      else if (dayStatus.status === "absent") counts.absent += 1;
      else if (dayStatus.status === "half_day") counts.halfDay += 1;
      else if (dayStatus.status === "leave") counts.leave += 1;
      else if (dayStatus.status === "late") counts.late += 1;
      else if (dayStatus.status === "weekend_off") counts.weekendOff += 1;
      else if (dayStatus.status === "holiday") counts.holiday += 1;
      else counts.notMarked += 1;

      if (!["weekend_off", "holiday", "not_marked"].includes(dayStatus.status)) {
        counts.marked += 1;
      }

      return dayStatus;
    });

    return {
      employee,
      days,
      counts,
    };
  });

  return {
    month: `${String(year).padStart(4, "0")}-${String(monthNumber).padStart(2, "0")}`,
    totalStaff: employees.length,
    markedDays: distinctMarkedDates.size,
    totals,
    items,
  };
};

const listSalaryStructures = async ({ businessId, query = {} }) => {
  const { page, limit, skip } = buildPagination(query);
  const sort = buildSort(query.sortBy, query.sortOrder, salarySortFields);
  const filters = { businessId };

  if (query.status) {
    filters.status = query.status;
  }

  if (query.employeeId) {
    filters.employeeId = query.employeeId;
  }

  const [items, total] = await Promise.all([
    SalaryStructure.find(filters)
      .populate("employeeId", "employeeCode name role department status salaryType")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    SalaryStructure.countDocuments(filters),
  ]);

  return buildPaginatedResponse({ items, total, page, limit });
};

const getSalaryStructuresByEmployee = async ({ businessId, employeeId }) => {
  await ensureEmployeeBelongsToBusiness(businessId, employeeId);

  return SalaryStructure.find({ businessId, employeeId })
    .sort("-effectiveFrom")
    .populate("employeeId", "employeeCode name role department status salaryType");
};

const upsertSalaryStructure = async ({
  businessId,
  employeeId,
  payload,
  structureId = null,
}) => {
  const employee = await ensureEmployeeBelongsToBusiness(businessId, employeeId);
  const nextPayload = {
    businessId,
    employeeId: employee._id,
    salaryType: payload.salaryType,
    baseSalary: Number(payload.baseSalary || 0),
    dailyWage: Number(payload.dailyWage || 0),
    commissionEnabled: Boolean(payload.commissionEnabled),
    commissionType: payload.commissionType || "none",
    commissionValue: Number(payload.commissionValue || 0),
    effectiveFrom: normalizeDateOnly(payload.effectiveFrom),
    effectiveTo: payload.effectiveTo ? normalizeDateOnly(payload.effectiveTo) : null,
    status: payload.status || "active",
  };

  if (structureId) {
    const structure = await SalaryStructure.findOne({ _id: structureId, businessId });

    if (!structure) {
      throw new AppError("Salary structure not found", 404);
    }

    Object.assign(structure, nextPayload);
    await structure.save();
    return structure.populate("employeeId", "employeeCode name role department status salaryType");
  }

  if (nextPayload.status === "active") {
    await SalaryStructure.updateMany(
      { businessId, employeeId, status: "active" },
      { $set: { status: "inactive", effectiveTo: nextPayload.effectiveFrom } }
    );
  }

  const structure = await SalaryStructure.create(nextPayload);

  // TODO: Payroll generation should read from the latest active salary structure during pay-run creation.
  return structure.populate("employeeId", "employeeCode name role department status salaryType");
};

module.exports = {
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
};
