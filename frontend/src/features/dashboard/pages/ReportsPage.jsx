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
import { reportsSummaryRequest } from "../../auth/api";

const ReportsPage = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadReports = async () => {
      setIsLoading(true);

      try {
        const response = await reportsSummaryRequest();
        setData(response);
      } catch (loadError) {
        setError(loadError.response?.data?.message || "Unable to load reports");
      } finally {
        setIsLoading(false);
      }
    };

    loadReports();
  }, []);

  if (isLoading) {
    return <p className="text-sm text-slate-300">Loading reports...</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-300">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 p-6 sm:p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-100">Reports</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Sales, tax, inventory, payments, and profit reports</h2>
        <p className="mt-3 max-w-3xl text-sm text-brand-100/90">
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
            <p>Gross profit: {data.profitReport.grossProfit.toFixed(2)}</p>
            <p>Purchase tax: {data.profitReport.totalPurchaseTax.toFixed(2)}</p>
          </div>
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

