import { useEffect, useState } from "react";
import { ErrorState } from "../../../components/ui/PageState";
import { authStore } from "../../../store/authStore";
import { uiStore } from "../../../store/uiStore";
import AttendanceTable from "../components/AttendanceTable";
import {
  getAttendanceRequest,
  getMonthlyAttendanceSummaryRequest,
  getMonthlyTeamAttendanceRequest,
  createHolidayRequest,
  markAttendanceRequest,
} from "../hrApi";

const getTodayDateValue = () => new Date().toISOString().slice(0, 10);
const getCurrentMonthValue = () => new Date().toISOString().slice(0, 7);

const dayCellMeta = (status) => {
  if (status === "present") return { code: "P", className: "bg-emerald-50 border-emerald-200 text-emerald-800" };
  if (status === "absent") return { code: "A", className: "bg-rose-50 border-rose-200 text-rose-800" };
  if (status === "half_day") return { code: "H", className: "bg-amber-50 border-amber-200 text-amber-800" };
  if (status === "holiday") return { code: "O", className: "bg-violet-50 border-violet-200 text-violet-800" };
  if (status === "leave") return { code: "L", className: "bg-indigo-50 border-indigo-200 text-indigo-800" };
  if (status === "late") return { code: "T", className: "bg-sky-50 border-sky-200 text-sky-800" };
  if (status === "weekend_off") return { code: "W", className: "bg-slate-50 border-slate-200 text-slate-700" };
  return { code: "-", className: "bg-white/70 border-[color:var(--panel-border)] text-[color:var(--text-muted)]" };
};

const AttendancePage = () => {
  const { user } = authStore();
  const [selectedDate, setSelectedDate] = useState(getTodayDateValue());
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue());
  const [attendanceItems, setAttendanceItems] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [teamMonth, setTeamMonth] = useState(getCurrentMonthValue());
  const [teamAttendance, setTeamAttendance] = useState(null);
  const [teamError, setTeamError] = useState("");
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const canManageHR = ["owner", "admin"].includes(user?.role) || user?.permissions?.canManageHR;
  const canViewHR = canManageHR || user?.permissions?.canViewHR;

  const loadAttendance = async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const data = await getAttendanceRequest(selectedDate);
      setAttendanceItems(
        data.items.map((row) => ({
          employee: row.employee,
          attendance: {
            _id: row.attendance?._id || "",
            employeeId: row.employee._id,
            date: selectedDate,
            status: row.attendance?.status || "present",
            checkIn: row.attendance?.checkIn || "",
            checkOut: row.attendance?.checkOut || "",
            overtimeHours: row.attendance?.overtimeHours || 0,
            notes: row.attendance?.notes || "",
          },
        }))
      );
    } catch (error) {
      setLoadError(error.response?.data?.message || "Unable to load attendance");
    } finally {
      setIsLoading(false);
    }
  };

  const loadSummary = async () => {
    setIsLoadingSummary(true);
    setSummaryError("");

    try {
      const data = await getMonthlyAttendanceSummaryRequest(selectedMonth);
      setMonthlySummary(data);
    } catch (error) {
      setSummaryError(error.response?.data?.message || "Unable to load monthly summary");
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const loadTeamAttendance = async () => {
    setIsLoadingTeam(true);
    setTeamError("");

    try {
      const data = await getMonthlyTeamAttendanceRequest(teamMonth);
      setTeamAttendance(data);
    } catch (error) {
      setTeamError(error.response?.data?.message || "Unable to load monthly team attendance");
    } finally {
      setIsLoadingTeam(false);
    }
  };

  const handleMarkHolidayForAll = async () => {
    const confirmed = window.confirm(`Mark ${selectedDate} as Holiday for all employees?`);
    if (!confirmed) return;

    try {
      await createHolidayRequest({ date: selectedDate });
      uiStore.getState().pushToast({
        tone: "success",
        message: "Holiday marked for all employees.",
      });
      await loadTeamAttendance();
    } catch (error) {
      uiStore.getState().pushToast({
        tone: "danger",
        message: error.response?.data?.message || "Unable to mark holiday",
      });
    }
  };

  useEffect(() => {
    if (canViewHR) {
      loadAttendance();
    } else {
      setIsLoading(false);
    }
  }, [canViewHR, selectedDate]);

  useEffect(() => {
    if (canViewHR) {
      loadSummary();
    } else {
      setIsLoadingSummary(false);
    }
  }, [canViewHR, selectedMonth]);

  useEffect(() => {
    if (canViewHR) {
      loadTeamAttendance();
    } else {
      setIsLoadingTeam(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewHR]);

  const handleRowChange = (employeeId, field, value) => {
    setAttendanceItems((current) =>
      current.map((row) =>
        row.employee._id === employeeId
          ? {
              ...row,
              attendance: {
                ...row.attendance,
                [field]: field === "overtimeHours" ? value : value,
              },
            }
          : row
      )
    );
  };

  const handleSaveAttendance = async () => {
    setIsSaving(true);
    setSaveError("");

    try {
      await markAttendanceRequest({
        records: attendanceItems.map((row) => ({
          employeeId: row.employee._id,
          date: selectedDate,
          status: row.attendance.status,
          checkIn: row.attendance.checkIn,
          checkOut: row.attendance.checkOut,
          overtimeHours: Number(row.attendance.overtimeHours || 0),
          notes: row.attendance.notes,
        })),
      });
      uiStore.getState().pushToast({
        tone: "success",
        message: "Attendance saved successfully.",
      });
      await Promise.all([loadAttendance(), loadSummary()]);
    } catch (error) {
      setSaveError(error.response?.data?.message || "Unable to save attendance");
    } finally {
      setIsSaving(false);
    }
  };

  if (!canViewHR) {
    return (
      <ErrorState
        title="HR access required"
        description="Only business owners, admins, or users with HR view permission can access attendance."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6">
        <div className="mb-5">
          <h2 className="text-2xl font-semibold text-[color:var(--text-primary)]">Monthly Team Attendance</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">View all staff attendance at one place for {teamMonth}.</p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-col gap-3 sm:flex-row md:max-w-xl">
            <label className="block w-full sm:max-w-xs">
              <input
                type="month"
                value={teamMonth}
                onChange={(event) => setTeamMonth(event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[color:var(--accent)] dark:bg-slate-950 dark:text-white"
              />
            </label>
            <button
              type="button"
              onClick={loadTeamAttendance}
              disabled={isLoadingTeam}
              className="rounded-2xl border border-[color:var(--panel-border)] bg-white/60 px-6 py-3 text-sm font-semibold text-[color:var(--text-primary)] shadow-sm disabled:opacity-70 dark:bg-slate-950/40"
            >
              {isLoadingTeam ? "Loading..." : "Load Month"}
            </button>
          </div>

          {teamAttendance ? (
            <div className="flex w-full flex-wrap items-center justify-start gap-2 text-sm text-[color:var(--text-muted)] md:w-auto md:justify-end">
              <span className="rounded-full border border-[color:var(--panel-border)] bg-white/50 px-3 py-1 dark:bg-slate-950/40">
                <span className="font-semibold text-[color:var(--text-primary)]">{teamAttendance.totalStaff}</span> staff
              </span>
              <span className="rounded-full border border-[color:var(--panel-border)] bg-white/50 px-3 py-1 dark:bg-slate-950/40">
                <span className="font-semibold text-[color:var(--text-primary)]">{teamAttendance.markedDays}</span> marked days
              </span>
              <span className="rounded-full border border-[color:var(--panel-border)] bg-white/50 px-3 py-1 dark:bg-slate-950/40">
                <span className="font-semibold text-[color:var(--text-primary)]">{teamAttendance.totals.present}</span> P /{" "}
                <span className="font-semibold text-[color:var(--text-primary)]">{teamAttendance.totals.absent}</span> A /{" "}
                <span className="font-semibold text-[color:var(--text-primary)]">{teamAttendance.totals.halfDay}</span> H
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--text-muted)]">
          {[
            ["P", "Present", "bg-emerald-50 text-emerald-700"],
            ["A", "Absent", "bg-rose-50 text-rose-700"],
            ["H", "Half Day", "bg-amber-50 text-amber-700"],
            ["O", "Holiday", "bg-violet-50 text-violet-700"],
            ["W", "Weekend Off", "bg-slate-50 text-slate-700"],
            ["-", "Not Marked", "bg-white/60 text-slate-600 dark:bg-slate-950/40 dark:text-slate-300"],
          ].map(([code, label, cls]) => (
            <span key={code} className={`inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border)] px-3 py-1 ${cls}`}>
              <span className="font-semibold">{code}</span>
              <span>{label}</span>
            </span>
          ))}
        </div>

        {teamError ? <p className="mt-4 text-sm text-rose-400">{teamError}</p> : null}

        {!teamError && isLoadingTeam ? (
          <div className="mt-5 rounded-3xl border border-[color:var(--panel-border)] bg-white/60 p-8 text-center text-[color:var(--text-muted)] dark:bg-slate-950/40">Loading monthly attendance...</div>
        ) : null}

        {!teamError && !isLoadingTeam && teamAttendance ? (
          <div className="mt-5 space-y-4">
            {teamAttendance.items.map((row) => (
              <div key={row.employee._id} className="rounded-3xl border border-[color:var(--panel-border)] bg-white/40 p-4 dark:bg-slate-950/30">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-semibold text-[color:var(--text-primary)]">{row.employee.name}</div>
                    <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                      {row.employee.role}{row.employee.email ? ` | ${row.employee.email}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {[
                      ["P", row.counts.present, "bg-emerald-50 text-emerald-700"],
                      ["A", row.counts.absent, "bg-rose-50 text-rose-700"],
                      ["H", row.counts.halfDay, "bg-amber-50 text-amber-700"],
                      ["W", row.counts.weekendOff, "bg-slate-50 text-slate-700"],
                      ["-", row.counts.notMarked, "bg-white/60 text-slate-600 dark:bg-slate-950/40 dark:text-slate-300"],
                    ].map(([code, value, cls]) => (
                      <span
                        key={code}
                        className={`inline-flex items-center gap-2 rounded-lg border border-[color:var(--panel-border)] px-2.5 py-1 ${cls}`}
                      >
                        <span className="font-semibold">{code}</span>
                        <span className="font-semibold">{value}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {row.days.map((day) => {
                    const meta = dayCellMeta(day.status);
                    const dayNumber = Number(day.date.slice(-2));
                    return (
                      <div
                        key={day.date}
                        className={`flex h-10 w-10 flex-col items-center justify-center rounded-lg border text-[11px] leading-tight ${meta.className}`}
                        title={`${day.date} • ${day.status.replaceAll("_", " ")}`}
                      >
                        <div className="text-[10px] opacity-80">{String(dayNumber).padStart(2, "0")}</div>
                        <div className="font-semibold">{meta.code}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">Attendance register</h3>
            <label className="block sm:ml-3">
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-white/80 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[color:var(--accent)] dark:bg-slate-950 dark:text-white"
              />
            </label>
            {canManageHR ? (
              <button
                type="button"
                onClick={handleMarkHolidayForAll}
                className="rounded-2xl border border-[color:var(--panel-border)] bg-white/60 px-4 py-2.5 text-sm font-semibold text-[color:var(--text-primary)] shadow-sm dark:bg-slate-950/40"
                title="Mark this date as Holiday for all employees"
              >
                Mark holiday
              </button>
            ) : null}
          </div>
          {canManageHR ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAttendance}
              className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-70"
            >
              {isSaving ? "Saving..." : "Save attendance"}
            </button>
          ) : null}
        </div>
        {saveError ? <p className="mb-4 text-sm text-rose-400">{saveError}</p> : null}
        <AttendanceTable items={attendanceItems} isLoading={isLoading} loadError={loadError} canManage={canManageHR} onFieldChange={handleRowChange} />
      </section>

      <section className="rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">Monthly summary</h3>
          <label className="block sm:max-w-[220px]">
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--panel-border)] bg-white/80 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[color:var(--accent)] dark:bg-slate-950 dark:text-white"
            />
          </label>
        </div>
        {summaryError ? <ErrorState title="Unable to load monthly summary" description={summaryError} /> : null}
        {!summaryError && isLoadingSummary ? (
          <div className="rounded-3xl border border-[color:var(--panel-border)] bg-white/60 p-8 text-center text-[color:var(--text-muted)] dark:bg-slate-950/40">Loading summary...</div>
        ) : !summaryError ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--panel-border)] text-left text-sm text-[color:var(--text-primary)]">
              <thead>
                <tr className="text-[color:var(--text-muted)]">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Present</th>
                  <th className="px-4 py-3 font-medium">Absent</th>
                  <th className="px-4 py-3 font-medium">Half Day</th>
                  <th className="px-4 py-3 font-medium">Leave</th>
                  <th className="px-4 py-3 font-medium">Late</th>
                  <th className="px-4 py-3 font-medium">Overtime</th>
                  <th className="px-4 py-3 font-medium">Payable Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--panel-border)]">
                {monthlySummary.map((row) => (
                  <tr key={row.employee._id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[color:var(--text-primary)]">{row.employee.name}</div>
                      <div className="mt-1 text-xs text-[color:var(--text-muted)]">{row.employee.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3">{row.presentDays}</td>
                    <td className="px-4 py-3">{row.absentDays}</td>
                    <td className="px-4 py-3">{row.halfDays}</td>
                    <td className="px-4 py-3">{row.leaveDays}</td>
                    <td className="px-4 py-3">{row.lateDays}</td>
                    <td className="px-4 py-3">{row.overtimeHours}</td>
                    <td className="px-4 py-3 font-semibold text-[color:var(--text-primary)]">{row.payableDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default AttendancePage;
