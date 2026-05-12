import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ErrorState, EmptyState, LoadingState } from "../../../components/ui/PageState";
import MetricCard from "../components/MetricCard";
import { dashboardSummaryRequest } from "../../auth/api";

const statusColors = ["#38bdf8", "#34d399", "#f59e0b", "#f43f5e", "#a78bfa"];

const DashboardHomePage = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);

      try {
        const response = await dashboardSummaryRequest();
        setData(response);
      } catch (loadError) {
        setError(loadError.response?.data?.message || "Unable to load dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (isLoading) {
    return <LoadingState title="Loading dashboard" description="Crunching your latest business metrics." />;
  }

  if (error) {
    return <ErrorState title="Unable to load dashboard" description={error} />;
  }

  if (!data) {
    return <EmptyState title="No dashboard data yet" description="Create invoices, products, and purchases to populate the dashboard." />;
  }

  const metrics = [
    { label: "Total sales", value: `${data.metrics.totalSales.toFixed(2)}`, change: "All issued invoices" },
    { label: "Monthly revenue", value: `${data.metrics.monthlyRevenue.toFixed(2)}`, change: "Current month" },
    { label: "Paid amount", value: `${data.metrics.paidAmount.toFixed(2)}`, change: "Collected revenue" },
    { label: "Unpaid amount", value: `${data.metrics.unpaidAmount.toFixed(2)}`, change: "Outstanding" },
    { label: "Overdue invoices", value: `${data.metrics.overdueInvoices}`, change: "Past due date" },
    { label: "Total invoices", value: `${data.metrics.totalInvoices}`, change: "Created invoices" },
    { label: "Low stock products", value: `${data.metrics.lowStockProducts}`, change: "Need restock" },
    { label: "Out-of-stock products", value: `${data.metrics.outOfStockProducts}`, change: "Immediate attention" },
  ];

  return (
    <div className="space-y-6">
      <section className="theme-hero rounded-[2rem] p-6 sm:p-8">
        <p className="theme-hero-kicker text-sm uppercase tracking-[0.3em]">Command center</p>
        <h2 className="theme-hero-title mt-3 max-w-3xl text-3xl font-semibold sm:text-4xl">
          Sales, inventory risk, collections, and stock activity in one view.
        </h2>
        <p className="theme-hero-copy mt-3 max-w-3xl text-sm">
          This dashboard summarizes the current business only. Revenue charts, invoice status mix,
          top products, recent invoices, and stock movement activity are all tenant-scoped.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Revenue chart</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueChart}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#38bdf8" fill="url(#revenueFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Invoice status chart</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.invoiceStatusChart} dataKey="count" nameKey="status" outerRadius={100}>
                  {data.invoiceStatusChart.map((entry, index) => (
                    <Cell key={entry.status} fill={statusColors[index % statusColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Top selling products</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topSellingProducts}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="_id" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="quantitySold" fill="#34d399" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Recent invoices</h3>
          <div className="mt-4 space-y-3">
            {data.recentInvoices.map((invoice) => (
              <div key={invoice._id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">{invoice.invoiceNumber}</p>
                <p>{invoice.customerId?.name || invoice.customerDetails?.name}</p>
                <p>Total: {invoice.grandTotal}</p>
                <p>Status: {invoice.paymentStatus}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Recent stock movements</h3>
          <div className="mt-4 space-y-3">
            {data.recentStockMovements.map((movement) => (
              <div key={movement._id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">{movement.productId?.name || "Product"}</p>
                <p>{movement.type} {movement.quantity}</p>
                <p>{movement.previousStock} to {movement.newStock}</p>
                <p>{new Date(movement.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Inventory alerts</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-medium text-amber-300">Low stock</p>
              <div className="space-y-2">
                {data.lowStockProducts.length ? data.lowStockProducts.map((product) => (
                  <div key={product._id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300">
                    <p className="font-semibold text-white">{product.name}</p>
                    <p>{product.currentStock} left</p>
                  </div>
                )) : <p className="text-sm text-slate-400">No low stock alerts.</p>}
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-medium text-rose-300">Out of stock</p>
              <div className="space-y-2">
                {data.outOfStockProducts.length ? data.outOfStockProducts.map((product) => (
                  <div key={product._id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300">
                    <p className="font-semibold text-white">{product.name}</p>
                    <p>Current stock: {product.currentStock}</p>
                  </div>
                )) : <p className="text-sm text-slate-400">No out-of-stock alerts.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardHomePage;
