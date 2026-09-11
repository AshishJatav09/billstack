import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  BadgeIndianRupee,
  Box,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock3,
  FilePlus2,
  ListChecks,
  PackagePlus,
  ReceiptText,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { ErrorState, LoadingState } from "../../../components/ui/PageState";
import { dashboardSummaryRequest, getBusinessModulesRequest } from "../../auth/api";
import { useAuth } from "../../auth/useAuth";
import { isActiveModule, isSelfHostedWorkspace, productLabelForWorkspace, shouldShowDashboardSurface, visibleModuleKeys } from "../../workspace/workspaceVisibility";

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const dateKey = (value) => (value ? new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "");
const isOverdue = (dueDate) => dateKey(new Date()) > dateKey(dueDate);

const badgeTone = (status) =>
  status === "paid"
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
    : status === "partial"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : status === "cancelled"
        ? "bg-slate-500/10 text-slate-500"
        : "bg-rose-500/10 text-rose-600 dark:text-rose-300";

const canRoleUse = (user, roles) => !roles?.length || roles.includes(user?.role);

const DashboardHomePage = () => {
  const [data, setData] = useState(null);
  const [moduleData, setModuleData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { business, user } = useAuth();

  useEffect(() => {
    const load = async () => {
      try {
        const [summary, modules] = await Promise.all([dashboardSummaryRequest(), getBusinessModulesRequest()]);
        setData(summary);
        setModuleData(modules);
      } catch (loadError) {
        setError(loadError.response?.data?.message || "Unable to load dashboard");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const alerts = useMemo(
    () =>
      !data
        ? []
        : [
            data.metrics.overdueInvoices > 0 && {
              tone: "rose",
              icon: Clock3,
              title: `${data.metrics.overdueInvoices} overdue invoice${data.metrics.overdueInvoices === 1 ? "" : "s"}`,
              detail: `${formatMoney(data.metrics.unpaidAmount)} remains outstanding`,
              action: "Review sales",
              to: "/dashboard/invoices",
            },
            isActiveModule(moduleData, "inventory") && data.metrics.lowStockProducts > 0 && {
              tone: "amber",
              icon: Box,
              title: `${data.metrics.lowStockProducts} low-stock item${data.metrics.lowStockProducts === 1 ? "" : "s"}`,
              detail: "Review inventory before the next sale",
              action: "View inventory",
              to: "/dashboard/products",
            },
            business?.subscription &&
              !business.subscription.isAccessible && {
                tone: "rose",
                icon: CircleAlert,
                title: "Subscription access needs attention",
                detail: "Some workspace features may be restricted",
                action: "Open subscription",
              to: isSelfHostedWorkspace(moduleData, business) ? "/dashboard/settings" : "/dashboard/subscription",
            },
          ].filter(Boolean),
    [data, business, moduleData]
  );

  if (isLoading) {
    return <LoadingState title="Loading your business snapshot" description="Preparing sales, collections, and operational alerts." />;
  }

  if (error) {
    return <ErrorState title="Unable to load dashboard" description={error} />;
  }

  const metrics = data.metrics;
  const activeModules = visibleModuleKeys(moduleData);
  const showModule = (moduleKey) => (!moduleKey || activeModules.has(moduleKey)) && shouldShowDashboardSurface(moduleKey, moduleData, business);
  const quickActions = [
    { label: "Create invoice", detail: "Start a sale", icon: FilePlus2, to: "/dashboard/invoices?action=create", moduleKey: "invoices", primary: true },
    { label: "Create quotation", detail: "Draft an estimate", icon: BadgeIndianRupee, to: "/dashboard/quotes", moduleKey: "quotations" },
    { label: "Add customer", detail: "New contact", icon: UsersRound, to: "/dashboard/customers", moduleKey: "customers" },
    { label: `Add ${productLabelForWorkspace(moduleData).replace("Products / ", "").replace("Products & ", "").toLowerCase()}`, detail: productLabelForWorkspace(moduleData), icon: PackagePlus, to: "/dashboard/products", moduleKey: "products_services" },
    { label: "Record expense", detail: "Track operating spend", icon: ReceiptText, to: "/dashboard/expenses", moduleKey: "expenses", roles: ["owner", "admin", "accountant"] },
    { label: "New production job", detail: "Plan stock output", icon: ClipboardList, to: "/dashboard/production-jobs", moduleKey: "production_job_work" },
  ].filter((action) => showModule(action.moduleKey) && canRoleUse(user, action.roles));
  const checklist = data.onboardingChecklist || [];
  const completedChecklist = checklist.filter((item) => item.complete).length;
  const remainingChecklist = checklist.length - completedChecklist;
  const kpis = [
    {
      label: "Total sales",
      value: formatMoney(metrics.totalSales),
      detail: `${metrics.totalInvoices} issued invoice${metrics.totalInvoices === 1 ? "" : "s"}`,
      tone: "text-brand-600 dark:text-brand-300",
    },
    { label: "Payment collected", value: formatMoney(metrics.paidAmount), detail: "Recorded received payments", tone: "text-emerald-600 dark:text-emerald-300" },
    { label: "Net after expenses", value: formatMoney(metrics.netOperatingDifference), detail: `${formatMoney(metrics.monthlyPaidExpenses)} paid expenses cut`, tone: "text-slate-900 dark:text-slate-100" },
    { label: "Receivables", value: formatMoney(metrics.unpaidAmount), detail: "Awaiting collection", tone: "text-amber-600 dark:text-amber-300" },
    {
      label: "Overdue amount",
      value: formatMoney(
        data.recentInvoices
          .filter((invoice) => invoice.status !== "cancelled" && invoice.balanceDue > 0 && isOverdue(invoice.dueDate))
          .reduce((sum, invoice) => sum + invoice.balanceDue, 0)
      ),
      detail: `${metrics.overdueInvoices} past due`,
      tone: "text-rose-600 dark:text-rose-300",
    },
  ];
  const workflowMetrics = data.workflowMetrics || metrics.workflowMetrics || {};
  const workflowStats = [
    { label: "Active orders", value: workflowMetrics.activeOrders || 0, detail: `${workflowMetrics.processingOrders || 0} in processing`, icon: ClipboardList, to: "/dashboard/orders", moduleKey: "order_management" },
    { label: "Overdue tasks", value: workflowMetrics.overdueTasks || 0, detail: "Past due and not completed", icon: ListChecks, to: "/dashboard/tasks", moduleKey: "projects_tasks" },
    { label: "Monthly billing due", value: workflowMetrics.recurringDueSoon || 0, detail: "Due within 7 days", icon: RefreshCw, to: "/dashboard/recurring-billing", moduleKey: "recurring_billing" },
    { label: "Production jobs", value: workflowMetrics.openProductionJobs || 0, detail: "Open job-work items", icon: ClipboardList, to: "/dashboard/production-jobs", moduleKey: "production_job_work" },
    { label: "Expiring batches", value: workflowMetrics.expiringBatches || 0, detail: "Within 30 days", icon: Box, to: "/dashboard/batches", moduleKey: "batch_expiry" },
    { label: "Pending dispatches", value: workflowMetrics.pendingDispatches || 0, detail: "Not delivered yet", icon: PackagePlus, to: "/dashboard/dispatches", moduleKey: "dispatch_fulfilment" },
    { label: "Approvals", value: workflowMetrics.pendingApprovals || 0, detail: "Waiting for decision", icon: FilePlus2, to: "/dashboard/approvals", moduleKey: "documents_approvals" },
  ].filter((item) => showModule(item.moduleKey));

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-6">
      <section
        className="flex flex-col gap-5 rounded-2xl border p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between"
        style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}
      >
        <div>
          <p className="text-sm font-medium text-brand-600 dark:text-brand-300">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Good day, {user?.name?.split(" ")[0] || "there"}.</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Here is the financial pulse for{" "}
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
              {business?.name || "your business"}
            </span>
            .
          </p>
        </div>
        <button
          onClick={() => navigate(showModule("invoices") ? "/dashboard/invoices?action=create" : "/dashboard/customers")}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <FilePlus2 size={17} /> {showModule("invoices") ? "Create invoice" : "Open workspace"}
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((item) => (
          <div key={item.label} className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              {item.label}
            </p>
            <p className={`mt-3 text-2xl font-semibold tracking-tight ${item.tone}`}>{item.value}</p>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              {item.detail}
            </p>
          </div>
        ))}
      </section>

      {workflowStats.length ? <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {workflowStats.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.to)}
              className="rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
              style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-xl bg-brand-500/10 p-2 text-brand-600 dark:text-brand-200">
                  <Icon size={17} />
                </span>
                <ArrowRight size={15} style={{ color: "var(--text-muted)" }} />
              </div>
              <p className="mt-4 text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{item.value}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                {item.detail}
              </p>
            </button>
          );
        })}
      </section> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(290px,0.8fr)]">
        <div className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">Sales trend</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                Issued invoice value across the last 12 months
              </p>
            </div>
            <span className="rounded-lg bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-600 dark:text-brand-200">Monthly</span>
          </div>
          <div className="mt-5 h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueChart} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(100,116,139,.16)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.4} fill="url(#salesFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
          <h3 className="font-semibold">Collection snapshot</h3>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Receivables requiring follow-up
          </p>
          <div className="mt-6 space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span style={{ color: "var(--text-muted)" }}>Collected</span>
                <strong>{formatMoney(metrics.paidAmount)}</strong>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${metrics.totalSales ? Math.min(100, (metrics.paidAmount / metrics.totalSales) * 100) : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span style={{ color: "var(--text-muted)" }}>Receivables</span>
                <strong>{formatMoney(metrics.unpaidAmount)}</strong>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-700/60">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${metrics.totalSales ? Math.min(100, (metrics.unpaidAmount / metrics.totalSales) * 100) : 0}%` }} />
              </div>
            </div>
            <div className="rounded-xl border border-rose-500/15 bg-rose-500/5 p-3">
              <p className="text-xs font-medium text-rose-600 dark:text-rose-300">Overdue attention</p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                {metrics.overdueInvoices ? `${metrics.overdueInvoices} invoices are past their due date.` : "No overdue invoices right now."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(290px,0.8fr)]">
        <div className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Recent transactions</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                Latest invoices in this business
              </p>
            </div>
            <button onClick={() => navigate("/dashboard/invoices")} className="hidden items-center gap-1 text-sm font-medium text-brand-600 sm:flex">
              View sales <ArrowRight size={15} />
            </button>
          </div>
          <div className="mt-5 grid gap-3">
            {data.recentInvoices.map((invoice) => (
              <div key={invoice._id} className="grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center" style={{ borderColor: "var(--panel-border)", background: "var(--theme-surface-soft)" }}>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{invoice.invoiceNumber}</p>
                  <p className="mt-1 truncate" style={{ color: "var(--text-muted)" }}>{invoice.customerId?.name || invoice.customerDetails?.name || "Customer"}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div><p className="text-xs" style={{ color: "var(--text-muted)" }}>Amount</p><p className="font-semibold">{formatMoney(invoice.grandTotal)}</p></div>
                  <div><p className="text-xs" style={{ color: "var(--text-muted)" }}>Due</p><p>{formatDate(invoice.dueDate)}</p></div>
                  <div><p className="text-xs" style={{ color: "var(--text-muted)" }}>Status</p><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${badgeTone(invoice.paymentStatus)}`}>{invoice.paymentStatus}</span></div>
                </div>
                <button onClick={() => navigate("/dashboard/invoices")} className="justify-self-start text-xs font-semibold text-brand-600 sm:justify-self-end">Open</button>
              </div>
            ))}
            {!data.recentInvoices.length ? <p className="rounded-xl border border-dashed p-8 text-center text-sm" style={{ borderColor: "var(--panel-border)", color: "var(--text-muted)" }}>No invoices yet. Create your first invoice to begin.</p> : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
            <h3 className="font-semibold">Quick actions</h3>
            <div className="mt-4 grid gap-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    disabled={action.disabled}
                    onClick={() => action.to && navigate(action.to)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                      action.primary ? "border-brand-600 bg-brand-600 text-white" : "border-transparent hover:bg-slate-500/5 disabled:cursor-not-allowed disabled:opacity-55"
                    }`}
                    style={!action.primary ? { color: "var(--text-primary)" } : undefined}
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={17} />
                      <span>
                        <span className="block text-sm font-medium">{action.label}</span>
                        <span className={`block text-xs ${action.primary ? "text-brand-100" : ""}`} style={!action.primary ? { color: "var(--text-muted)" } : undefined}>
                          {action.detail}
                        </span>
                      </span>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                );
              })}
              {!quickActions.length ? <p className="rounded-xl bg-slate-500/5 p-3 text-sm" style={{ color: "var(--text-muted)" }}>No quick actions are available for your current role.</p> : null}
            </div>
          </div>

          {checklist.length ? (
            <div className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Setup checklist</h3>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    {remainingChecklist ? `${remainingChecklist} step${remainingChecklist === 1 ? "" : "s"} left to complete your workspace.` : "Your core workspace setup is complete."}
                  </p>
                </div>
                <span className="rounded-full bg-brand-500/10 px-2 py-1 text-xs font-semibold text-brand-600 dark:text-brand-200">
                  {completedChecklist}/{checklist.length}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {checklist.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    disabled={item.complete || !item.to}
                    onClick={() => item.to && navigate(item.to)}
                    className="flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition hover:bg-slate-500/5 disabled:cursor-default disabled:hover:bg-transparent"
                    style={{ borderColor: "var(--panel-border)" }}
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2 size={16} className={item.complete ? "text-emerald-500" : "text-slate-300"} />
                      <span style={{ color: item.complete ? "var(--text-muted)" : "var(--text-primary)" }}>{item.label}</span>
                    </span>
                    {!item.complete && item.to ? <ArrowRight size={14} className="text-brand-600" /> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={17} className="text-amber-500" />
              <h3 className="font-semibold">Operational alerts</h3>
            </div>
            <div className="mt-4 space-y-3">
              {alerts.length ? (
                alerts.map((alert) => {
                  const Icon = alert.icon;
                  return (
                    <button
                      key={alert.title}
                      onClick={() => navigate(alert.to)}
                      className={`w-full rounded-xl border p-3 text-left ${alert.tone === "rose" ? "border-rose-500/15 bg-rose-500/5" : "border-amber-500/15 bg-amber-500/5"}`}
                    >
                      <div className="flex gap-3">
                        <Icon size={17} className={alert.tone === "rose" ? "text-rose-500" : "text-amber-500"} />
                        <div>
                          <p className="text-sm font-medium">{alert.title}</p>
                          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                            {alert.detail}
                          </p>
                          <p className="mt-2 text-xs font-semibold text-brand-600">{alert.action}</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-xl bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">Everything looks in order. There are no urgent operational alerts.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardHomePage;
