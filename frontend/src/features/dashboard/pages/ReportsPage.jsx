import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { gstSummaryRequest, reportsSummaryRequest } from "../../auth/api";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));

const ReportsPage = () => {
  const [data, setData] = useState(null);
  const [gstData, setGstData] = useState(null);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadReports = async () => {
      setIsLoading(true);
      setError("");
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

  const chartRows = useMemo(() => (data?.monthlySales || []).map((item) => ({ month: `${item._id.month}/${String(item._id.year).slice(-2)}`, totalSales: item.totalSales, paidAmount: item.paidAmount })), [data]);

  if (isLoading) return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading reports...</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;

  return <div className="mx-auto max-w-[1500px] space-y-6 overflow-x-hidden pb-8">
    <section className="rounded-2xl border p-5 sm:p-7" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
      <p className="text-sm font-medium text-brand-600">Reports / GST</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">Sales, tax and payment reports</h2>
      <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--text-muted)" }}>Allocation-backed reports use BillStack&apos;s derived payment state, so paid invoices stop showing as pending.</p>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Taxable sales" value={money(gstData?.sales?.taxableValue)} />
      <Metric label="CGST" value={money(gstData?.sales?.cgst)} />
      <Metric label="SGST" value={money(gstData?.sales?.sgst)} />
      <Metric label="IGST" value={money(gstData?.sales?.igst)} />
      <Metric label="Total GST" value={money(gstData?.sales?.totalGst)} strong />
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <Card title="Monthly sales">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows}>
              <CartesianGrid stroke="rgba(148,163,184,0.25)" vertical={false} />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip formatter={(value) => money(value)} />
              <Bar dataKey="totalSales" name="Sales" fill="#2563eb" radius={[8, 8, 0, 0]} />
              <Bar dataKey="paidAmount" name="Paid" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card title="GST reporting workspace" description="Snapshot-based GST from issued invoices and purchases. Cancelled invoices are excluded.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>From<input type="date" value={dateRange.from} onChange={(event) => setDateRange((current) => ({ ...current, from: event.target.value }))} className="field mt-1" /></label>
          <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>To<input type="date" value={dateRange.to} onChange={(event) => setDateRange((current) => ({ ...current, to: event.target.value }))} className="field mt-1" /></label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric label="Input GST" value={money(gstData?.purchases?.totalGst)} compact />
          <Metric label="Sales GST" value={money(gstData?.sales?.totalGst)} compact />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border no-scrollbar" style={{ borderColor: "var(--panel-border)" }}>
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-slate-500/5 text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}><tr><th className="p-3">HSN/SAC</th><th className="p-3 text-right">Taxable value</th></tr></thead>
            <tbody>{Object.entries(gstData?.hsnSacSummary || {}).map(([code, value]) => <tr key={code} className="border-t" style={{ borderColor: "var(--panel-border)" }}><td className="p-3 font-medium">{code}</td><td className="p-3 text-right">{money(value)}</td></tr>)}{!Object.keys(gstData?.hsnSacSummary || {}).length ? <tr><td colSpan="2" className="p-6 text-center" style={{ color: "var(--text-muted)" }}>No GST HSN/SAC data for this range.</td></tr> : null}</tbody>
          </table>
        </div>
      </Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <ListCard title="Customer-wise sales" rows={data.customerWiseSales} empty="No customer sales yet." render={(item) => <><p className="font-semibold">{item._id || "Unknown customer"}</p><p>Total sales: {money(item.totalSales)}</p><p>Paid: {money(item.paidAmount)}</p><p>Balance: {money(item.balanceDue)}</p></>} />
      <ListCard title="Pending payments" rows={data.pendingPayment} empty="No pending invoice payments." render={(invoice) => <><p className="font-semibold">{invoice.invoiceNumber}</p><p>{invoice.customerId?.name || invoice.customerDetails?.name}</p><p>Balance due: {money(invoice.balanceDue)}</p><p>Status: {String(invoice.paymentStatus || "unpaid").replaceAll("_", " ")}</p></>} />
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <ListCard title="Product-wise sales" rows={data.productWiseSales} empty="No product sales yet." render={(item) => <><p className="font-semibold">{item._id || "Product/service"}</p><p>Quantity sold: {item.quantitySold}</p><p>Revenue: {money(item.revenue)}</p><p>Tax: {money(item.tax)}</p></>} />
      <Card title="Tax and profit report">
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Tax collected" value={money(data.taxReport.totalTaxCollected)} compact />
          <Metric label="Taxable sales" value={money(data.taxReport.taxableSales)} compact />
          <Metric label="Total expenses" value={money(data.profitReport.totalExpenses)} compact />
          <Metric label="Operating difference" value={money(data.profitReport.netOperatingDifference)} compact />
        </div>
      </Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <ListCard title="Expense report" rows={data.expenseReport?.categoryWiseExpenses || []} empty="No expense data yet." render={(item) => <><p className="font-semibold">{item._id || "Uncategorized"}</p><p>Total: {money(item.total)}</p><p>Paid: {money(item.paid)}</p><p>Unpaid: {money(item.unpaid)}</p><p>GST recorded: {money(item.gstRecorded)}</p></>} />
      <ListCard title="Purchase report" rows={data.purchaseReport} empty="No purchases yet." render={(purchase) => <><p className="font-semibold">{purchase.supplierId?.supplierName || "Supplier"}</p><p>Date: {purchase.purchaseDate ? new Date(purchase.purchaseDate).toLocaleDateString("en-IN") : "—"}</p><p>Total: {money(purchase.totalAmount)}</p><p>Status: {purchase.paymentStatus}</p></>} />
    </section>
  </div>;
};

const Card = ({ title, description, children }) => <section className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><h3 className="text-lg font-semibold">{title}</h3>{description ? <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{description}</p> : null}<div className="mt-4">{children}</div></section>;
const Metric = ({ label, value, strong, compact }) => <div className={`rounded-2xl border ${compact ? "p-4" : "p-5"}`} style={{ borderColor: "var(--panel-border)", background: "var(--theme-surface-soft)" }}><p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p><p className={`mt-2 ${strong ? "text-2xl" : "text-xl"} font-semibold`}>{value}</p></div>;
const ListCard = ({ title, rows = [], empty, render }) => <Card title={title}>{rows.length ? <div className="grid gap-3">{rows.slice(0, 20).map((item) => <div key={item._id || item.invoiceNumber} className="rounded-xl border p-4 text-sm leading-6" style={{ borderColor: "var(--panel-border)", background: "var(--theme-surface-soft)" }}>{render(item)}</div>)}</div> : <p className="rounded-xl border border-dashed p-6 text-center text-sm" style={{ borderColor: "var(--panel-border)", color: "var(--text-muted)" }}>{empty}</p>}</Card>;

export default ReportsPage;
