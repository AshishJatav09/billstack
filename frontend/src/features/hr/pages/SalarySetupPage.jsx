import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui/PageState";
import { authStore } from "../../../store/authStore";
import { uiStore } from "../../../store/uiStore";
import SalaryStructureForm from "../components/SalaryStructureForm";
import {
  createSalaryStructureRequest,
  getEmployeeSalaryStructuresRequest,
  listEmployeeOptionsRequest,
  listSalaryStructuresRequest,
  updateSalaryStructureRequest,
} from "../hrApi";

const initialForm = {
  employeeId: "",
  salaryType: "monthly",
  baseSalary: "",
  dailyWage: "",
  commissionEnabled: false,
  commissionType: "none",
  commissionValue: "",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: "",
  status: "active",
};

const SalarySetupPage = () => {
  const { user } = authStore();
  const [employees, setEmployees] = useState([]);
  const [result, setResult] = useState({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [errors, setErrors] = useState({});
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const canManageHR = ["owner", "admin"].includes(user?.role) || user?.permissions?.canManageHR;
  const canViewHR = canManageHR || user?.permissions?.canViewHR;

  const loadEmployees = async () => {
    const data = await listEmployeeOptionsRequest({ status: "" });
    setEmployees(data);
  };

  const loadStructures = async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const data = await listSalaryStructuresRequest({
        page: 1,
        limit: 50,
        sortBy: "effectiveFrom",
        sortOrder: "desc",
      });
      setResult(data);
    } catch (error) {
      setLoadError(error.response?.data?.message || "Unable to load salary structures");
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmployeeHistory = async (employeeId) => {
    if (!employeeId) {
      setHistory([]);
      return;
    }

    setHistoryError("");

    try {
      const data = await getEmployeeSalaryStructuresRequest(employeeId);
      setHistory(data);
    } catch (error) {
      setHistoryError(error.response?.data?.message || "Unable to load employee salary history");
    }
  };

  useEffect(() => {
    if (!canViewHR) {
      setIsLoading(false);
      return;
    }

    const loadInitial = async () => {
      try {
        await Promise.all([loadEmployees(), loadStructures()]);
      } catch (error) {
        setLoadError(error.response?.data?.message || "Unable to initialise salary setup");
        setIsLoading(false);
      }
    };

    loadInitial();
  }, [canViewHR]);

  useEffect(() => {
    if (form.employeeId) {
      loadEmployeeHistory(form.employeeId);
    } else {
      setHistory([]);
    }
  }, [form.employeeId]);

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const resetForm = () => {
    setEditingId("");
    setForm(initialForm);
    setErrors({});
    setSaveError("");
    setHistoryError("");
  };

  const handleEdit = (structure) => {
    setEditingId(structure._id);
    setForm({
      employeeId: structure.employeeId?._id || structure.employeeId || "",
      salaryType: structure.salaryType || "monthly",
      baseSalary: structure.baseSalary ?? "",
      dailyWage: structure.dailyWage ?? "",
      commissionEnabled: structure.commissionEnabled || false,
      commissionType: structure.commissionType || "none",
      commissionValue: structure.commissionValue ?? "",
      effectiveFrom: structure.effectiveFrom ? new Date(structure.effectiveFrom).toISOString().slice(0, 10) : initialForm.effectiveFrom,
      effectiveTo: structure.effectiveTo ? new Date(structure.effectiveTo).toISOString().slice(0, 10) : "",
      status: structure.status || "active",
    });
    setErrors({});
    setSaveError("");
    loadEmployeeHistory(structure.employeeId?._id || structure.employeeId);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setErrors({});
    setSaveError("");

    try {
      if (editingId) {
        await updateSalaryStructureRequest(editingId, form);
      } else {
        await createSalaryStructureRequest(form);
      }

      uiStore.getState().pushToast({
        tone: "success",
        message: editingId ? "Salary structure updated successfully." : "Salary structure saved successfully.",
      });
      const activeEmployeeId = form.employeeId;
      resetForm();
      await Promise.all([loadStructures(), loadEmployees()]);
      if (activeEmployeeId) {
        await loadEmployeeHistory(activeEmployeeId);
      }
    } catch (error) {
      setErrors(error.response?.data?.errors || {});
      setSaveError(error.response?.data?.message || "Unable to save salary structure");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canViewHR) {
    return (
      <ErrorState
        title="HR access required"
        description="Only business owners, admins, or users with HR view permission can access salary setup."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-brand-300">HR</p>
          <h2 className="mt-3 text-3xl font-semibold text-[color:var(--text-primary)]">Salary setup</h2>
          <p className="mt-3 max-w-3xl text-sm text-[color:var(--text-muted)]">
            Configure monthly, daily, commission, or mixed salary structures. This data is designed to feed future payroll, commission, and advance recovery engines.
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SalaryStructureForm
          employees={employees}
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

        <div className="space-y-6">
          <div className="rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">Current salary structures</h3>
              <p className="text-sm text-[color:var(--text-muted)]">{result.pagination.total} total</p>
            </div>
            {isLoading ? (
              <LoadingState title="Loading salary structures" description="Fetching salary setup records for this business." />
            ) : loadError && !result.items.length ? (
              <ErrorState title="Unable to load salary structures" description={loadError} />
            ) : (
              <div className="space-y-3">
                {result.items.map((structure) => (
                  <div key={structure._id} className="rounded-2xl border border-[color:var(--panel-border)] bg-white/60 p-4 dark:bg-slate-950/50">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-[color:var(--text-primary)]">{structure.employeeId?.name || "Employee"}</p>
                          <span className="rounded-full bg-brand-500/15 px-3 py-1 text-xs font-semibold text-brand-200">
                            {structure.salaryType}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${structure.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-300"}`}>
                            {structure.status}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-1 text-sm text-[color:var(--text-muted)]">
                          <p>{structure.employeeId?.employeeCode || "No code"} • {structure.employeeId?.role || "No role"}</p>
                          <p>Base salary: {structure.baseSalary || 0} • Daily wage: {structure.dailyWage || 0}</p>
                          <p>Commission: {structure.commissionEnabled ? `${structure.commissionType} (${structure.commissionValue || 0})` : "Disabled"}</p>
                          <p>Effective from: {new Date(structure.effectiveFrom).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {canManageHR ? (
                        <button onClick={() => handleEdit(structure)} className="rounded-xl border border-[color:var(--panel-border)] px-4 py-2 text-sm text-[color:var(--text-primary)]">
                          Edit
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {!result.items.length ? (
                  <EmptyState title="No salary structures yet" description="Create a salary structure for an employee to prepare future payroll workflows." />
                ) : null}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">Employee salary history</h3>
              <p className="text-sm text-[color:var(--text-muted)]">{form.employeeId ? `${history.length} record(s)` : "Select an employee"}</p>
            </div>
            {historyError ? (
              <ErrorState title="Unable to load employee salary history" description={historyError} />
            ) : history.length ? (
              <div className="space-y-3">
                {history.map((structure) => (
                  <div key={structure._id} className="rounded-2xl border border-[color:var(--panel-border)] bg-white/60 p-4 dark:bg-slate-950/50">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand-500/15 px-3 py-1 text-xs font-semibold text-brand-200">{structure.salaryType}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${structure.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-300"}`}>
                        {structure.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-1 text-sm text-[color:var(--text-muted)]">
                      <p>Base salary: {structure.baseSalary || 0}</p>
                      <p>Daily wage: {structure.dailyWage || 0}</p>
                      <p>Commission: {structure.commissionEnabled ? `${structure.commissionType} (${structure.commissionValue || 0})` : "Disabled"}</p>
                      <p>Effective from: {new Date(structure.effectiveFrom).toLocaleDateString()}</p>
                      <p>Effective to: {structure.effectiveTo ? new Date(structure.effectiveTo).toLocaleDateString() : "Open-ended"}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No salary history yet" description="Select an employee to view salary structure history or create a new one." />
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default SalarySetupPage;
