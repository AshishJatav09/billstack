import { EmptyState, ErrorState, LoadingState } from "../../../components/ui/PageState";

const statusBadgeClasses = {
  active: "bg-emerald-500/15 text-emerald-300",
  inactive: "bg-rose-500/15 text-rose-300",
};

const EmployeeTable = ({
  result,
  isLoading,
  loadError,
  onEdit,
  onDeactivate,
  filters,
  setFilters,
}) => {
  if (isLoading) {
    return <LoadingState title="Loading employees" description="Fetching employee records for this business." />;
  }

  if (loadError && !result.items.length) {
    return <ErrorState title="Unable to load employees" description={loadError} />;
  }

  return (
    <div className="rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">Employee list</h3>
        <p className="text-sm text-[color:var(--text-muted)]">{result.pagination.total} total</p>
      </div>

      <div className="space-y-3">
        {result.items.map((employee) => (
          <div key={employee._id} className="rounded-2xl border border-[color:var(--panel-border)] bg-white/60 p-4 dark:bg-slate-950/50">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-[color:var(--text-primary)]">{employee.name}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses[employee.status] || statusBadgeClasses.inactive}`}>
                    {employee.status}
                  </span>
                  <span className="rounded-full bg-brand-500/15 px-3 py-1 text-xs font-semibold text-brand-200">
                    {employee.employeeCode}
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-sm text-[color:var(--text-muted)]">
                  <p>{employee.role}{employee.department ? ` • ${employee.department}` : ""}</p>
                  <p>{employee.phone || "No phone"}{employee.email ? ` • ${employee.email}` : ""}</p>
                  <p>Joined: {new Date(employee.joiningDate).toLocaleDateString()}</p>
                  <p>Salary type: {employee.salaryType}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onEdit(employee)} className="rounded-xl border border-[color:var(--panel-border)] px-4 py-2 text-sm text-[color:var(--text-primary)]">
                  Edit
                </button>
                {employee.status === "active" ? (
                  <button onClick={() => onDeactivate(employee._id)} className="rounded-xl border border-rose-500/40 px-4 py-2 text-sm text-rose-300">
                    Mark inactive
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {!result.items.length ? (
          <EmptyState title="No employees found" description="Create your first employee record to start attendance and salary setup." />
        ) : null}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          disabled={filters.page <= 1}
          onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
          className="rounded-xl border border-[color:var(--panel-border)] px-4 py-2 text-sm text-[color:var(--text-primary)] disabled:opacity-40"
        >
          Previous
        </button>
        <p className="text-sm text-[color:var(--text-muted)]">
          Page {result.pagination.page} of {result.pagination.totalPages}
        </p>
        <button
          type="button"
          disabled={result.pagination.page >= result.pagination.totalPages}
          onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
          className="rounded-xl border border-[color:var(--panel-border)] px-4 py-2 text-sm text-[color:var(--text-primary)] disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default EmployeeTable;
