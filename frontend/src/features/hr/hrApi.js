import api from "../../api/axios";

export const listEmployeesRequest = async (params) => {
  const response = await api.get("/hr/employees", { params });
  return response.data.data;
};

export const listEmployeeOptionsRequest = async (params) => {
  const response = await api.get("/hr/employees/options", { params });
  return response.data.data;
};

export const createEmployeeRequest = async (payload) => {
  const response = await api.post("/hr/employees", payload);
  return response.data.data;
};

export const updateEmployeeRequest = async (employeeId, payload) => {
  const response = await api.put(`/hr/employees/${employeeId}`, payload);
  return response.data.data;
};

export const deactivateEmployeeRequest = async (employeeId) => {
  const response = await api.delete(`/hr/employees/${employeeId}`);
  return response.data.data;
};

export const getAttendanceRequest = async (date) => {
  const response = await api.get("/hr/attendance", {
    params: { date },
  });
  return response.data.data;
};

export const getMonthlyAttendanceSummaryRequest = async (month) => {
  const response = await api.get("/hr/attendance/monthly-summary", {
    params: { month },
  });
  return response.data.data;
};

export const getMonthlyTeamAttendanceRequest = async (month) => {
  const response = await api.get("/hr/attendance/monthly-team", {
    params: { month },
  });
  return response.data.data;
};

export const markAttendanceRequest = async (payload) => {
  const response = await api.post("/hr/attendance/mark", payload);
  return response.data.data;
};

export const createHolidayRequest = async (payload) => {
  const response = await api.post("/hr/attendance/holidays", payload);
  return response.data.data;
};

export const listSalaryStructuresRequest = async (params) => {
  const response = await api.get("/hr/salary-structures", { params });
  return response.data.data;
};

export const getEmployeeSalaryStructuresRequest = async (employeeId) => {
  const response = await api.get(`/hr/salary-structures/${employeeId}`);
  return response.data.data;
};

export const createSalaryStructureRequest = async (payload) => {
  const response = await api.post("/hr/salary-structures", payload);
  return response.data.data;
};

export const updateSalaryStructureRequest = async (salaryStructureId, payload) => {
  const response = await api.put(`/hr/salary-structures/${salaryStructureId}`, payload);
  return response.data.data;
};
