import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui/PageState";
import MetricCard from "../../dashboard/components/MetricCard";
import {
  superAdminBusinessesRequest,
  superAdminListPlansRequest,
  superAdminOverviewRequest,
  superAdminToggleBusinessStatusRequest,
  superAdminUpdateBusinessPlanRequest,
} from "../api";
import { superAdminStore } from "../../../store/superAdminStore";
import { uiStore } from "../../../store/uiStore";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const planFeatureLabel = (value) => (value ? "Enabled" : "Locked");

const SuperAdminDashboardPage = () => {
  const { email, clearSession } = superAdminStore();
  const [overview, setOverview] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [plans, setPlans] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState({
    page: 1,
    planCode: "",
    isDisabled: "",
    search: "",
  });
  const [planSelections, setPlanSelections] = useState({});
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [businessError, setBusinessError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [busyBusinessId, setBusyBusinessId] = useState("");

  useEffect(() => {
    const loadOverview = async () => {
      setIsLoadingOverview(true);
      setOverviewError("");

      try {
        const [overviewData, plansData] = await Promise.all([
          superAdminOverviewRequest(),
          superAdminListPlansRequest(),
        ]);
        setOverview(overviewData);
        setPlans(plansData);
      } catch (error) {
        setOverviewError(error.response?.data?.message || "Unable to load platform overview");
      } finally {
        setIsLoadingOverview(false);
      }
    };

    loadOverview();
  }, []);

  useEffect(() => {
    const loadBusinesses = async () => {
      setIsLoadingBusinesses(true);
      setBusinessError("");

      try {
        const data = await superAdminBusinessesRequest({
          page: query.page,
          limit: 10,
          planCode: query.planCode || undefined,
          isDisabled: query.isDisabled || undefined,
          search: query.search || undefined,
          sortBy: "createdAt",
          sortOrder: "desc",
        });

        setBusinesses(data.items || []);
        setPagination(
          data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 }
        );
        setPlanSelections((current) => {
          const nextState = { ...current };
          (data.items || []).forEach((business) => {
            nextState[business.id] = current[business.id] || business.planCode;
          });
          return nextState;
        });
      } catch (error) {
        setBusinessError(error.response?.data?.message || "Unable to load businesses");
      } finally {
        setIsLoadingBusinesses(false);
      }
    };

    loadBusinesses();
  }, [query]);

  const metrics = useMemo(() => {
    if (!overview) {
      return [];
    }

    return [
      {
        label: "Total businesses",
        value: `${overview.metrics.totalBusinesses}`,
        change: "All onboarded tenants",
      },
      {
        label: "Total users",
        value: `${overview.metrics.totalUsers}`,
        change: "Across every tenant",
      },
      {
        label: "Active subscriptions",
        value: `${overview.metrics.activeSubscriptions}`,
        change: "Paid and currently usable",
      },
      {
        label: "MRR",
        value: formatCurrency(overview.metrics.monthlyRecurringRevenue),
        change: "Estimated monthly recurring revenue",
      },
      {
        label: "Trial users",
        value: `${overview.metrics.trialUsers}`,
        change: "Businesses on Free plan",
      },
      {
        label: "Expired subscriptions",
        value: `${overview.metrics.expiredSubscriptions}`,
        change: "Need renewal or downgrade",
      },
    ];
  }, [overview]);

  const refreshAll = async () => {
    setSuccessMessage("");
    setOverviewError("");
    setBusinessError("");

    try {
      const [overviewData, businessData] = await Promise.all([
        superAdminOverviewRequest(),
        superAdminBusinessesRequest({
          page: query.page,
          limit: 10,
          planCode: query.planCode || undefined,
          isDisabled: query.isDisabled || undefined,
          search: query.search || undefined,
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
      ]);

      setOverview(overviewData);
      setBusinesses(businessData.items || []);
      setPagination(
        businessData.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 }
      );
    } catch (error) {
      const message = error.response?.data?.message || "Unable to refresh platform data";
      setOverviewError(message);
      setBusinessError(message);
    }
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setQuery((current) => ({
      ...current,
      page: 1,
      search: searchInput.trim(),
    }));
  };

  const handleToggleBusiness = async (businessId) => {
    setBusyBusinessId(businessId);
    setBusinessError("");
    setSuccessMessage("");

    try {
      const updatedBusiness = await superAdminToggleBusinessStatusRequest(businessId);
      setBusinesses((current) =>
        current.map((business) => (business.id === businessId ? updatedBusiness : business))
      );
      setSuccessMessage(
        `Business ${updatedBusiness.isDisabled ? "disabled" : "enabled"} successfully.`
      );
      uiStore.getState().pushToast({
        tone: "success",
        message: `Business ${updatedBusiness.isDisabled ? "disabled" : "enabled"} successfully.`,
      });
      await refreshAll();
    } catch (error) {
      setBusinessError(error.response?.data?.message || "Unable to update business status");
    } finally {
      setBusyBusinessId("");
    }
  };

  const handlePlanUpdate = async (businessId) => {
    setBusyBusinessId(businessId);
    setBusinessError("");
    setSuccessMessage("");

    try {
      const updatedBusiness = await superAdminUpdateBusinessPlanRequest(
        businessId,
        planSelections[businessId]
      );
      setBusinesses((current) =>
        current.map((business) => (business.id === businessId ? updatedBusiness : business))
      );
      setSuccessMessage(`Plan updated to ${updatedBusiness.plan.name}.`);
      uiStore.getState().pushToast({
        tone: "success",
        message: `Plan updated to ${updatedBusiness.plan.name}.`,
      });
      await refreshAll();
    } catch (error) {
      setBusinessError(error.response?.data?.message || "Unable to update business plan");
    } finally {
      setBusyBusinessId("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-700 p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-brand-200">Super Admin Panel</p>
              <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
                Platform health, revenue analytics, and business control in one place.
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-200">
                This view is platform-wide. You can review subscription health, track recurring
                revenue, assign plans, and disable businesses that should no longer access BillStack.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <p className="font-semibold text-white">{email}</p>
              <p className="mt-1">Platform owner session</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={refreshAll}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-sm"
                >
                  Refresh data
                </button>
                <button
                  type="button"
                  onClick={clearSession}
                  className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </section>

        {overviewError ? <p className="text-sm text-rose-300">{overviewError}</p> : null}
        {successMessage ? <p className="text-sm text-emerald-300">{successMessage}</p> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoadingOverview
            ? Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
              ))
            : metrics.length
              ? metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)
              : <EmptyState title="No platform metrics yet" description="Businesses and subscriptions will appear here once the platform is in use." />}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Revenue analytics</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Subscription-linked monthly revenue across paid plans.
                </p>
              </div>
            </div>
            <div className="mt-4 h-72">
              {isLoadingOverview ? (
                <LoadingState title="Loading analytics" description="Preparing subscription revenue trends." />
              ) : overviewError ? (
                <ErrorState title="Unable to load analytics" description={overviewError} />
              ) : overview?.revenueChart?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview?.revenueChart || []}>
                    <defs>
                      <linearGradient id="platformRevenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#38bdf8"
                      fill="url(#platformRevenueFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState title="No revenue analytics yet" description="Paid subscriptions will populate this chart." />
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-white">Plan catalog</h2>
            <p className="mt-1 text-sm text-slate-400">
              Assign these plans to businesses from the management table below.
            </p>
            <div className="mt-4 space-y-3">
              {plans.map((plan) => (
                <div key={plan.code} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold text-white">{plan.name}</p>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                      {plan.code}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-300">
                    <p>
                      Invoice limit:{" "}
                      {plan.invoiceMonthlyLimit === Number.MAX_SAFE_INTEGER
                        ? "Unlimited"
                        : `${plan.invoiceMonthlyLimit} / month`}
                    </p>
                    <p>Staff limit: {plan.staffUserLimit}</p>
                    <p>Inventory: {planFeatureLabel(plan.inventoryAccess)}</p>
                    <p>Reports: {planFeatureLabel(plan.reportsAccess)}</p>
                    <p>PDF templates: {planFeatureLabel(plan.pdfTemplatesAccess)}</p>
                    <p>Sharing: {planFeatureLabel(plan.sharingAccess)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Businesses</h2>
              <p className="mt-1 text-sm text-slate-400">
                View status, switch plans, and disable or enable tenant access.
              </p>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 sm:flex-row">
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search name or email"
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500"
              />
              <select
                value={query.planCode}
                onChange={(event) =>
                  setQuery((current) => ({
                    ...current,
                    page: 1,
                    planCode: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">All plans</option>
                {plans.map((plan) => (
                  <option key={plan.code} value={plan.code}>
                    {plan.name}
                  </option>
                ))}
              </select>
              <select
                value={query.isDisabled}
                onChange={(event) =>
                  setQuery((current) => ({
                    ...current,
                    page: 1,
                    isDisabled: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">All status</option>
                <option value="false">Enabled</option>
                <option value="true">Disabled</option>
              </select>
              <button
                type="submit"
                className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white"
              >
                Search
              </button>
            </form>
          </div>

          {businessError ? <p className="mt-4 text-sm text-rose-300">{businessError}</p> : null}

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.2em] text-slate-400">
                  <th className="pb-3 pr-4">Business</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Subscription</th>
                  <th className="pb-3 pr-4">Created</th>
                  <th className="pb-3 pr-4">Plan</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingBusinesses ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      Loading businesses...
                    </td>
                  </tr>
                ) : businesses.length ? (
                  businesses.map((business) => (
                    <tr key={business.id} className="border-b border-white/5 align-top">
                      <td className="py-4 pr-4">
                        <p className="font-semibold text-white">{business.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{business.email || business.billingEmail || ""}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {business.billingEmail || business.email || "No email"}
                        </p>
                      </td>
                      <td className="py-4 pr-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            business.isDisabled
                              ? "bg-rose-500/15 text-rose-200"
                              : "bg-emerald-500/15 text-emerald-200"
                          }`}
                        >
                          {business.isDisabled ? "Disabled" : "Enabled"}
                        </span>
                      </td>
                      <td className="py-4 pr-4">
                        <p>{business.subscription?.status || "inactive"}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {business.subscription?.currentEnd
                            ? `Ends ${new Date(business.subscription.currentEnd).toLocaleDateString()}`
                            : "No paid cycle"}
                        </p>
                      </td>
                      <td className="py-4 pr-4 text-xs text-slate-400">
                        {business.createdAt
                          ? new Date(business.createdAt).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="py-4 pr-4">
                        <select
                          value={planSelections[business.id] || business.planCode}
                          onChange={(event) =>
                            setPlanSelections((current) => ({
                              ...current,
                              [business.id]: event.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
                        >
                          {plans.map((plan) => (
                            <option key={plan.code} value={plan.code}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handlePlanUpdate(business.id)}
                            disabled={busyBusinessId === business.id}
                            className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                          >
                            Save plan
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleBusiness(business.id)}
                            disabled={busyBusinessId === business.id}
                            className={`rounded-2xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                              business.isDisabled ? "bg-emerald-600" : "bg-rose-600"
                            }`}
                          >
                            {business.isDisabled ? "Enable" : "Disable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      No businesses match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing page {pagination.page} of {pagination.totalPages} with {pagination.total} businesses total.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
                className="rounded-2xl border border-white/10 px-4 py-2 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  setQuery((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
                className="rounded-2xl border border-white/10 px-4 py-2 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SuperAdminDashboardPage;
