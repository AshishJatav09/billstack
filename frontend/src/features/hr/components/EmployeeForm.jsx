const salaryTypeOptions = [
  { value: "monthly", label: "Monthly" },
  { value: "daily", label: "Daily" },
  { value: "commission", label: "Commission" },
  { value: "mixed", label: "Mixed" },
];

const commissionTypeOptions = [
  { value: "none", label: "None" },
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed" },
];

const EmployeeForm = ({
  form,
  errors,
  editingId,
  isSaving,
  saveError,
  canManage,
  onChange,
  onSubmit,
  onCancel,
}) => (
  <form onSubmit={onSubmit} className="rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6">
    <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">{editingId ? "Edit employee" : "Add employee"}</h3>
    <p className="mt-2 text-sm text-[color:var(--text-muted)]">
      Phase 1 HR foundation. Payroll, advances, leave, and portal flows can build on this structure later.
    </p>

    <div className="mt-5 grid gap-4 md:grid-cols-2">
      {[
        ["employeeCode", "Employee code", "text"],
        ["name", "Full name", "text"],
        ["phone", "Phone", "text"],
        ["email", "Email", "email"],
        ["role", "Job role", "text"],
        ["department", "Department", "text"],
        ["joiningDate", "Joining date", "date"],
        ["baseSalary", "Base salary", "number"],
        ["dailyWage", "Daily wage", "number"],
        ["commissionValue", "Commission value", "number"],
      ].map(([name, label, type]) => (
        <label key={name} className="block">
          <span className="mb-2 block text-sm text-[color:var(--text-primary)]">{label}</span>
          <input
            type={type}
            name={name}
            value={form[name]}
            onChange={onChange}
            disabled={!canManage}
            className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-950 dark:text-white"
          />
          {errors[name] ? <span className="mt-2 block text-xs text-rose-400">{errors[name]}</span> : null}
        </label>
      ))}

      <label className="block">
        <span className="mb-2 block text-sm text-[color:var(--text-primary)]">Salary type</span>
        <select
          name="salaryType"
          value={form.salaryType}
          onChange={onChange}
          disabled={!canManage}
          className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-950 dark:text-white"
        >
          {salaryTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {errors.salaryType ? <span className="mt-2 block text-xs text-rose-400">{errors.salaryType}</span> : null}
      </label>

      <label className="block">
        <span className="mb-2 block text-sm text-[color:var(--text-primary)]">Commission type</span>
        <select
          name="commissionType"
          value={form.commissionType}
          onChange={onChange}
          disabled={!canManage}
          className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-950 dark:text-white"
        >
          {commissionTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm text-[color:var(--text-primary)]">Status</span>
        <select
          name="status"
          value={form.status}
          onChange={onChange}
          disabled={!canManage}
          className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-950 dark:text-white"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>

      <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--panel-border)] bg-white/80 px-4 py-3 text-sm text-[color:var(--text-primary)] dark:bg-slate-950 md:col-span-2">
        <input
          type="checkbox"
          name="commissionEnabled"
          checked={Boolean(form.commissionEnabled)}
          onChange={onChange}
          disabled={!canManage}
        />
        Commission enabled
      </label>

      <label className="block md:col-span-2">
        <span className="mb-2 block text-sm text-[color:var(--text-primary)]">Notes</span>
        <textarea
          name="notes"
          rows="4"
          value={form.notes}
          onChange={onChange}
          disabled={!canManage}
          className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-950 dark:text-white"
        />
      </label>
    </div>

    {!canManage ? <p className="mt-4 text-sm text-[color:var(--text-muted)]">You currently have view-only HR access.</p> : null}
    {errors.contact ? <p className="mt-4 text-sm text-rose-400">{errors.contact}</p> : null}
    {saveError ? <p className="mt-4 text-sm text-rose-400">{saveError}</p> : null}
    <div className="mt-5 flex gap-3">
      <button type="submit" disabled={!canManage || isSaving} className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {isSaving ? "Saving..." : !canManage ? "Manage access required" : editingId ? "Update employee" : "Create employee"}
      </button>
      {editingId ? (
        <button type="button" onClick={onCancel} className="rounded-2xl border border-[color:var(--panel-border)] px-5 py-3 text-sm text-[color:var(--text-primary)]">
          Cancel
        </button>
      ) : null}
    </div>
  </form>
);

export default EmployeeForm;
