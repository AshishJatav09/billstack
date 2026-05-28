import { EmptyState, ErrorState, LoadingState } from "../../../components/ui/PageState";

const attendanceOptions = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half Day" },
  { value: "leave", label: "Leave" },
  { value: "late", label: "Late" },
];

const AttendanceTable = ({
  items,
  isLoading,
  loadError,
  canManage,
  onFieldChange,
}) => {
  if (isLoading) {
    return <LoadingState title="Loading attendance" description="Fetching employees and attendance for the selected date." />;
  }

  if (loadError && !items.length) {
    return <ErrorState title="Unable to load attendance" description={loadError} />;
  }

  if (!items.length) {
    return <EmptyState title="No employees available" description="Create employees first, then mark attendance for them here." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[color:var(--panel-border)] text-left text-sm text-[color:var(--text-primary)]">
        <thead>
          <tr className="text-[color:var(--text-muted)]">
            <th className="px-4 py-3 font-medium">Employee</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Check in</th>
            <th className="px-4 py-3 font-medium">Check out</th>
            <th className="px-4 py-3 font-medium">Overtime</th>
            <th className="px-4 py-3 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--panel-border)]">
          {items.map((row) => (
            <tr key={row.employee._id}>
              <td className="px-4 py-3 align-top">
                <div className="font-semibold text-[color:var(--text-primary)]">{row.employee.name}</div>
                <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                  {row.employee.employeeCode} • {row.employee.role}
                </div>
              </td>
              <td className="px-4 py-3">
                <select
                  value={row.attendance.status}
                  onChange={(event) => onFieldChange(row.employee._id, "status", event.target.value)}
                  disabled={!canManage}
                  className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-950 dark:text-white"
                >
                  {attendanceOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <input
                  value={row.attendance.checkIn}
                  onChange={(event) => onFieldChange(row.employee._id, "checkIn", event.target.value)}
                  disabled={!canManage}
                  placeholder="09:00"
                  className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-950 dark:text-white"
                />
              </td>
              <td className="px-4 py-3">
                <input
                  value={row.attendance.checkOut}
                  onChange={(event) => onFieldChange(row.employee._id, "checkOut", event.target.value)}
                  disabled={!canManage}
                  placeholder="18:00"
                  className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-950 dark:text-white"
                />
              </td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={row.attendance.overtimeHours}
                  onChange={(event) => onFieldChange(row.employee._id, "overtimeHours", event.target.value)}
                  disabled={!canManage}
                  className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-950 dark:text-white"
                />
              </td>
              <td className="px-4 py-3">
                <input
                  value={row.attendance.notes}
                  onChange={(event) => onFieldChange(row.employee._id, "notes", event.target.value)}
                  disabled={!canManage}
                  placeholder="Optional"
                  className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-950 dark:text-white"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AttendanceTable;
