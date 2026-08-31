import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { gstSummaryRequest, reportsSummaryRequest } from "../../auth/api";

const ReportsPage = () => {
  const [data, setData] = useState(null);
  const [gstData, setGstData] = useState(null);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadReports = async () => {
      setIsLoading(true);

      try {
        const [response, gst] = await Promise.all([reportsSummaryRequest(), gstSummaryRequest(dateRange)]);
        setData(response);
        setGstData(gst);
      } catch (loadError) {
        setError(loadError.response?.data?.message || "Unable to load reports");
      } finally {
        setIsLoading(false);
      }
    };

    loadReports();
  }, [dateRange.from, dateRange.to]);

  if (isLoading) {
    return <p className="text-sm text-slate-300">Loading reports...</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-300">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <section className="theme-hero rounded-[2rem] p-6 sm:p-8">
        <p className="theme-hero-kicker text-sm uppercase tracking-[0.3em]">Reports</p>
        <h2 className="theme-hero-title mt-3 text-3xl font-semibold">Sales, tax, inventory, payments, and profit reports</h2>
        <p className="theme-hero-copy mt-3 max-w-3xl text-sm">
          This section is protected by the reports feature guard. All datasets are aggregated for the
          current business only.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Monthly sales</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.monthlySales.map((item) => ({
                  month: `${item._id.month}/${String(item._id.year).slice(-2)}`,
                  totalSales: item.totalSales,
                }))}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="totalSales" fill="#38bdf8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Daily sales</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.dailySales
                  .slice()
                  .reverse()
                  .map((item) => ({
                    day: `${item._id.day}/${item._id.month}`,
                    totalSales: item.totalSales,
                  }))}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="totalSales" fill="#34d399" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Customer-wise sales</h3>
          <div className="mt-4 space-y-3">
            {data.customerWiseSales.map((item) => (
              <div key={item._id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">{item._id || "Unknown customer"}</p>
                <p>Total sales: {item.totalSales.toFixed(2)}</p>
                <p>Paid: {item.paidAmount.toFixed(2)}</p>
                <p>Balance: {item.balanceDue.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Product-wise sales</h3>
          <div className="mt-4 space-y-3">
            {data.productWiseSales.map((item) => (
              <div key={item._id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">{item._id}</p>
                <p>Quantity sold: {item.quantitySold}</p>
                <p>Revenue: {item.revenue.toFixed(2)}</p>
                <p>Tax: {item.tax.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300 xl:col-span-2">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">GST reporting workspace</h3>
              <p className="mt-2 text-sm text-slate-400">Snapshot-based GST reporting for sales and purchase summaries. Cancelled invoices are excluded by the API.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-400">From<input type="date" value={dateRange.from} onChange={(event) => setDateRange((current) => ({ ...current, from: event.target.value }))} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
              <label className="text-xs text-slate-400">To<input type="date" value={dateRange.to} onChange={(event) => setDateRange((current) => ({ ...current, to: event.target.value }))} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {["taxableValue", "cgst", "sgst", "igst", "totalGst"].map((key) => <div key={key} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">{key}</p><p className="mt-2 text-xl font-semibold text-white">{Number(gstData?.sales?.[key] || 0).toFixed(2)}</p><p className="mt-1 text-xs text-slate-500">Sales</p></div>)}
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Input GST</p><p className="mt-2 text-xl font-semibold text-white">{Number(gstData?.purchases?.totalGst || 0).toFixed(2)}</p><p className="mt-1 text-xs text-slate-500">Purchases</p></div>
          </div>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-[620px] w-full text-left text-sm">
              <thead className="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">HSN/SAC</th><th className="p-3 text-right">Taxable value</th></tr></thead>
              <tbody>{Object.entries(gstData?.hsnSacSummary || {}).map(([code, value]) => <tr key={code} className="border-t border-white/10"><td className="p-3 font-medium text-white">{code}</td><td className="p-3 text-right">{Number(value || 0).toFixed(2)}</td></tr>)}{!Object.keys(gstData?.hsnSacSummary || {}).length ? <tr><td colSpan="2" className="p-8 text-center text-slate-500">No GST HSN/SAC data for this range.</td></tr> : null}</tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          <h3 className="text-lg font-semibold text-white">Tax report</h3>
          <div className="mt-4 grid gap-2">
            <p>Total tax collected: {data.taxReport.totalTaxCollected.toFixed(2)}</p>
            <p>Total discount given: {data.taxReport.totalDiscountGiven.toFixed(2)}</p>
            <p>Taxable sales: {data.taxReport.taxableSales.toFixed(2)}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          <h3 className="text-lg font-semibold text-white">Profit report</h3>
          <div className="mt-4 grid gap-2">
            <p>Total revenue: {data.profitReport.totalRevenue.toFixed(2)}</p>
            <p>Total purchases: {data.profitReport.totalPurchases.toFixed(2)}</p>
            <p>Total expenses: {Number(data.profitReport.totalExpenses || 0).toFixed(2)}</p>
            <p>Gross profit: {data.profitReport.grossProfit.toFixed(2)}</p>
            <p>Operating difference: {Number(data.profitReport.netOperatingDifference || 0).toFixed(2)}</p>
            <p>Purchase tax: {data.profitReport.totalPurchaseTax.toFixed(2)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Expense report</h3>
            <p className="mt-1 text-slate-400">Operating expenses are tracked separately from purchases and inventory.</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total expenses</p>
            <p className="text-2xl font-semibold text-white">{Number(data.expenseReport?.totalExpenses || 0).toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><p className="text-slate-500">Paid</p><p className="mt-2 text-xl font-semibold text-white">{Number(data.expenseReport?.totalPaidExpenses || 0).toFixed(2)}</p></div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><p className="text-slate-500">Unpaid / partial</p><p className="mt-2 text-xl font-semibold text-white">{Number(data.expenseReport?.totalUnpaidExpenses || 0).toFixed(2)}</p></div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><p className="text-slate-500">GST recorded</p><p className="mt-2 text-xl font-semibold text-white">{Number(data.expenseReport?.totalExpenseGstRecorded || 0).toFixed(2)}</p></div>
        </div>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-[620px] w-full text-left text-sm">
            <thead className="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Category</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">Unpaid</th><th className="p-3 text-right">GST recorded</th></tr></thead>
            <tbody>{(data.expenseReport?.categoryWiseExpenses || []).map((item) => <tr key={item._id} className="border-t border-white/10"><td className="p-3 font-medium text-white">{item._id || "Uncategorized"}</td><td className="p-3 text-right">{Number(item.total || 0).toFixed(2)}</td><td className="p-3 text-right">{Number(item.paid || 0).toFixed(2)}</td><td className="p-3 text-right">{Number(item.unpaid || 0).toFixed(2)}</td><td className="p-3 text-right">{Number(item.gstRecorded || 0).toFixed(2)}</td></tr>)}{!(data.expenseReport?.categoryWiseExpenses || []).length ? <tr><td colSpan="5" className="p-8 text-center text-slate-500">No expense data yet.</td></tr> : null}</tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Inventory valuation</h3>
          <div className="mt-4 space-y-3">
            {data.inventoryValuation.slice(0, 12).map((item) => (
              <div key={item._id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">{item.name}</p>
                <p>Current stock: {item.currentStock}</p>
                <p>Cost valuation: {item.valuationAtCost.toFixed(2)}</p>
                <p>Selling valuation: {item.valuationAtSelling.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Pending payments</h3>
          <div className="mt-4 space-y-3">
            {data.pendingPayment.map((invoice) => (
              <div key={invoice._id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">{invoice.invoiceNumber}</p>
                <p>{invoice.customerId?.name || invoice.customerDetails?.name}</p>
                <p>Balance due: {invoice.balanceDue.toFixed(2)}</p>
                <p>Status: {invoice.paymentStatus}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Purchase report</h3>
          <div className="mt-4 space-y-3">
            {data.purchaseReport.map((purchase) => (
              <div key={purchase._id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">{purchase.supplierId?.supplierName || "Supplier"}</p>
                <p>Date: {new Date(purchase.purchaseDate).toLocaleDateString()}</p>
                <p>Total: {purchase.totalAmount.toFixed(2)}</p>
                <p>Status: {purchase.paymentStatus}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Stock movement report</h3>
          <div className="mt-4 space-y-3">
            {data.stockMovement.slice(0, 25).map((movement) => (
              <div key={movement._id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">{movement.productId?.name || "Product"}</p>
                <p>{movement.type} {movement.quantity}</p>
                <p>{movement.previousStock} to {movement.newStock}</p>
                <p>{new Date(movement.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ReportsPage;
