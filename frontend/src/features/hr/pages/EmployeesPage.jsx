import { useEffect, useState } from "react";
import { ErrorState } from "../../../components/ui/PageState";
import { authStore } from "../../../store/authStore";
import { uiStore } from "../../../store/uiStore";
import EmployeeForm from "../components/EmployeeForm";
import EmployeeTable from "../components/EmployeeTable";
import {
  createEmployeeRequest,
  deactivateEmployeeRequest,
  listEmployeesRequest,
  updateEmployeeRequest,
} from "../hrApi";

const initialForm = {
  employeeCode: "",
  name: "",
  phone: "",
  email: "",
  role: "",
  department: "",
  joiningDate: "",
  salaryType: "monthly",
  baseSalary: "",
  dailyWage: "",
  commissionEnabled: false,
  commissionType: "none",
  commissionValue: "",
  status: "active",
  notes: "",
};

const EmployeesPage = () => {
  const { user } = authStore();
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: "",
    status: "",
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [result, setResult] = useState({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [errors, setErrors] = useState({});
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const canManageHR = ["owner", "admin"].includes(user?.role) || user?.permissions?.canManageHR;
  const canViewHR = canManageHR || user?.permissions?.canViewHR;

  const loadEmployees = async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const data = await listEmployeesRequest(filters);
      setResult(data);
    } catch (error) {
      setLoadError(error.response?.data?.message || "Unable to load employees");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canViewHR) {
      loadEmployees();
    } else {
      setIsLoading(false);
    }
  }, [canViewHR, filters.page, filters.limit, filters.search, filters.status, filters.sortBy, filters.sortOrder]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, page: 1, [name]: value }));
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const handleEdit = (employee) => {
    setEditingId(employee._id);
    setForm({
      employeeCode: employee.employeeCode || "",
      name: employee.name || "",
      phone: employee.phone || "",
      email: employee.email || "",
      role: employee.role || "",
      department: employee.department || "",
      joiningDate: employee.joiningDate ? new Date(employee.joiningDate).toISOString().slice(0, 10) : "",
      salaryType: employee.salaryType || "monthly",
      baseSalary: employee.baseSalary ?? "",
      dailyWage: employee.dailyWage ?? "",
      commissionEnabled: employee.commissionEnabled || false,
      commissionType: employee.commissionType || "none",
      commissionValue: employee.commissionValue ?? "",
      status: employee.status || "active",
      notes: employee.notes || "",
    });
    setErrors({});
    setSaveError("");
  };

  const resetForm = () => {
    setEditingId("");
    setForm(initialForm);
    setErrors({});
    setSaveError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setErrors({});
    setSaveError("");

    try {
      if (editingId) {
        await updateEmployeeRequest(editingId, form);
      } else {
        await createEmployeeRequest(form);
      }

      uiStore.getState().pushToast({
        tone: "success",
        message: editingId ? "Employee updated successfully." : "Employee created successfully.",
      });
      resetForm();
      await loadEmployees();
    } catch (error) {
      setErrors(error.response?.data?.errors || {});
      setSaveError(error.response?.data?.message || "Unable to save employee");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (employeeId) => {
    try {
      await deactivateEmployeeRequest(employeeId);
      uiStore.getState().pushToast({
        tone: "success",
        message: "Employee marked inactive successfully.",
      });
      await loadEmployees();
    } catch (error) {
      setLoadError(error.response?.data?.message || "Unable to update employee status");
    }
  };

  if (!canViewHR) {
    return (
      <ErrorState
        title="HR access required"
        description="Only business owners, admins, or users with HR view permission can access employee records."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-brand-300">HR</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Employee management</h2>
            <p className="mt-3 max-w-3xl text-sm text-slate-400">
              Manage employee master records per business. This prepares attendance, payroll, commissions, and future employee portal access.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <input name="search" value={filters.search} onChange={handleFilterChange} placeholder="Search name, phone, role, department" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" />
            <select name="status" value={filters.status} onChange={handleFilterChange} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select name="sortBy" value={filters.sortBy} onChange={handleFilterChange} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
              <option value="createdAt">Created</option>
              <option value="name">Name</option>
              <option value="joiningDate">Joining date</option>
              <option value="department">Department</option>
            </select>
            <select name="sortOrder" value={filters.sortOrder} onChange={handleFilterChange} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white">
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <EmployeeForm
          form={form}
          errors={errors}
          editingId={editingId}
          isSaving={isSaving}
          saveError={saveError}
          canManage={canManageHR}
          onChange={handleFormChange}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />
        <EmployeeTable
          result={result}
          isLoading={isLoading}
          loadError={loadError}
          onEdit={handleEdit}
          onDeactivate={canManageHR ? handleDeactivate : () => {}}
          filters={filters}
          setFilters={setFilters}
        />
      </section>
    </div>
  );
};

export default EmployeesPage;
