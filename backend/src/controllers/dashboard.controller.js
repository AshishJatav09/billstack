const Invoice = require("../models/Invoice");
const Expense = require("../models/Expense");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const StockMovement = require("../models/StockMovement");
const Appointment = require("../models/Appointment");
const Order = require("../models/Order");
const ApprovalDocument = require("../models/ApprovalDocument");
const DispatchFulfilment = require("../models/DispatchFulfilment");
const ProductBatch = require("../models/ProductBatch");
const ProductionJob = require("../models/ProductionJob");
const RecurringBillingProfile = require("../models/RecurringBillingProfile");
const Task = require("../models/Task");
const asyncHandler = require("../utils/asyncHandler");
const { getDerivedInvoiceRows } = require("../services/financial-read.service");
const { isOverdueByBusinessDate } = require("../utils/business-date");

const startOfMonth = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const lastTwelveMonths = () => {
  const months = [];
  const current = new Date();

  for (let index = 11; index >= 0; index -= 1) {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    });
  }

  return months;
};

const getDashboardSummary = asyncHandler(async (req, res) => {
  const businessId = req.tenant.businessId;
  const monthStart = startOfMonth();
  const months = lastTwelveMonths();

  const [
    legacyInvoiceTotals,
    monthlyRevenueRaw,
    legacyInvoiceStatusRaw,
    topSellingProductsRaw,
    recentInvoices,
    recentStockMovements,
    lowStockProducts,
    outOfStockProducts,
    monthlyExpensesRaw,
    customerCount,
    productCount,
    activeOrderCount,
    processingOrderCount,
    overdueTaskCount,
    upcomingAppointmentCount,
    recurringDueSoonCount,
    openProductionJobCount,
    expiringBatchCount,
    pendingDispatchCount,
    pendingApprovalCount,
  ] = await Promise.all([
    Invoice.aggregate([
      {
        $match: {
          businessId: req.user.businessId,
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
          paidAmount: { $sum: "$amountPaid" },
          unpaidAmount: { $sum: "$balanceDue" },
          totalInvoices: { $sum: 1 },
          overdueInvoices: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$balanceDue", 0] },
                    { $lt: ["$dueDate", new Date()] },
                    { $ne: ["$paymentStatus", "cancelled"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    Invoice.aggregate([
      {
        $match: {
          businessId: req.user.businessId,
          status: { $ne: "cancelled" },
          invoiceDate: { $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1) },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$invoiceDate" },
            month: { $month: "$invoiceDate" },
          },
          revenue: { $sum: "$grandTotal" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
    ]),
    Invoice.aggregate([
      {
        $match: {
          businessId: req.user.businessId,
        },
      },
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
          amount: { $sum: "$grandTotal" },
        },
      },
    ]),
    Invoice.aggregate([
      {
        $match: {
          businessId: req.user.businessId,
          status: { $ne: "cancelled" },
        },
      },
      { $unwind: "$lineItems" },
      {
        $group: {
          _id: "$lineItems.productName",
          quantitySold: { $sum: "$lineItems.quantity" },
          revenue: { $sum: "$lineItems.itemTotal" },
        },
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 5 },
    ]),
    Invoice.find({
      businessId,
    })
      .populate("customerId", "name")
      .sort("-invoiceDate")
      .limit(5),
    StockMovement.find({
      businessId,
    })
      .populate("productId", "name sku")
      .populate("createdBy", "name")
      .sort("-createdAt")
      .limit(8),
    Product.find({
      businessId,
      isLowStock: true,
      isOutOfStock: false,
    })
      .sort("currentStock")
      .limit(8),
    Product.find({
      businessId,
      isOutOfStock: true,
    })
      .sort("name")
      .limit(8),
    Expense.aggregate([
      { $match: { businessId, status: { $ne: "CANCELLED" }, expenseDate: { $gte: monthStart } } },
      { $group: { _id: null, totalExpenses: { $sum: "$totalAmount" }, paidExpenses: { $sum: "$paidAmount" }, unpaidExpenses: { $sum: "$balanceAmount" }, gstRecorded: { $sum: "$taxAmount" } } },
    ]),
    Customer.countDocuments({ businessId }),
    Product.countDocuments({ businessId }),
    Order.countDocuments({ businessId, status: { $in: ["CONFIRMED", "PROCESSING", "PARTIALLY_FULFILLED"] } }),
    Order.countDocuments({ businessId, status: "PROCESSING" }),
    Task.countDocuments({ businessId, status: { $nin: ["DONE", "CANCELLED"] }, dueDate: { $lt: new Date() } }),
    Appointment.countDocuments({ businessId, status: { $in: ["SCHEDULED", "CONFIRMED"] }, startAt: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }),
    RecurringBillingProfile.countDocuments({ businessId, status: "ACTIVE", nextBillingDate: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }),
    ProductionJob.countDocuments({ businessId, status: { $in: ["PLANNED", "IN_PROGRESS"] } }),
    ProductBatch.countDocuments({ businessId, status: "ACTIVE", expiryDate: { $gte: new Date(), $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } }),
    DispatchFulfilment.countDocuments({ businessId, status: { $in: ["DRAFT", "PACKED", "DISPATCHED"] } }),
    ApprovalDocument.countDocuments({ businessId, status: "PENDING" }),
  ]);

  const derivedInvoices = await getDerivedInvoiceRows({ businessId, filter: {} });
  const activeInvoices = derivedInvoices.filter((invoice) => invoice.status !== "cancelled");
  const recentDerivedInvoices = derivedInvoices
    .slice()
    .sort((a, b) => new Date(b.invoiceDate || b.createdAt || 0) - new Date(a.invoiceDate || a.createdAt || 0))
    .slice(0, 5);
  const invoiceTotals = [{
    totalSales: activeInvoices.reduce((sum, invoice) => sum + Number(invoice.grandTotal || 0), 0),
    paidAmount: activeInvoices.reduce((sum, invoice) => sum + Number(invoice.amountPaid || 0), 0),
    unpaidAmount: activeInvoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0),
    totalInvoices: activeInvoices.length,
    overdueInvoices: activeInvoices.filter((invoice) => invoice.balanceDue > 0 && isOverdueByBusinessDate(invoice.dueDate)).length,
  }];
  const statusMap = new Map();
  derivedInvoices.forEach((invoice) => { const current = statusMap.get(invoice.paymentStatus) || { count: 0, amount: 0 }; current.count += 1; current.amount += Number(invoice.grandTotal || 0); statusMap.set(invoice.paymentStatus, current); });
  const invoiceStatusRaw = Array.from(statusMap, ([status, values]) => ({ _id: status, ...values }));

  const monthlyRevenueMap = new Map(
    monthlyRevenueRaw.map((item) => [
      `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      item.revenue,
    ])
  );

  const revenueChart = months.map((month) => ({
    month: month.label,
    revenue: monthlyRevenueMap.get(month.key) || 0,
  }));

  const monthlyRevenue = revenueChart[revenueChart.length - 1]?.revenue || 0;

  res.status(200).json({
    message: "Dashboard summary fetched successfully",
    data: {
      metrics: {
        totalSales: invoiceTotals[0]?.totalSales || 0,
        monthlyRevenue,
        paidAmount: invoiceTotals[0]?.paidAmount || 0,
        unpaidAmount: invoiceTotals[0]?.unpaidAmount || 0,
        overdueInvoices: invoiceTotals[0]?.overdueInvoices || 0,
        totalInvoices: invoiceTotals[0]?.totalInvoices || 0,
        lowStockProducts: lowStockProducts.length,
        outOfStockProducts: outOfStockProducts.length,
        monthlyExpenses: monthlyExpensesRaw[0]?.totalExpenses || 0,
        monthlyPaidExpenses: monthlyExpensesRaw[0]?.paidExpenses || 0,
        monthlyUnpaidExpenses: monthlyExpensesRaw[0]?.unpaidExpenses || 0,
        monthlyExpenseGstRecorded: monthlyExpensesRaw[0]?.gstRecorded || 0,
        netOperatingDifference: monthlyRevenue - (monthlyExpensesRaw[0]?.paidExpenses || 0),
        activeOrders: activeOrderCount,
        processingOrders: processingOrderCount,
        overdueTasks: overdueTaskCount,
        upcomingAppointments: upcomingAppointmentCount,
        recurringDueSoon: recurringDueSoonCount,
        openProductionJobs: openProductionJobCount,
        expiringBatches: expiringBatchCount,
        pendingDispatches: pendingDispatchCount,
        pendingApprovals: pendingApprovalCount,
      },
      workflowMetrics: {
        activeOrders: activeOrderCount,
        processingOrders: processingOrderCount,
        overdueTasks: overdueTaskCount,
        upcomingAppointments: upcomingAppointmentCount,
        recurringDueSoon: recurringDueSoonCount,
        openProductionJobs: openProductionJobCount,
        expiringBatches: expiringBatchCount,
        pendingDispatches: pendingDispatchCount,
        pendingApprovals: pendingApprovalCount,
      },
      topSellingProducts: topSellingProductsRaw,
      recentInvoices: recentDerivedInvoices,
      recentStockMovements,
      lowStockProducts,
      outOfStockProducts,
      revenueChart,
      invoiceStatusChart: invoiceStatusRaw.map((item) => ({
        status: item._id || "unknown",
        count: item.count,
        amount: item.amount,
      })),
      onboardingChecklist: [
        { key: "profile", label: "Business profile completed", complete: true },
        { key: "customer", label: "Add first customer", complete: customerCount > 0, to: "/dashboard/customers" },
        { key: "product", label: "Add first product/service", complete: productCount > 0, to: "/dashboard/products" },
        { key: "invoice", label: "Create first invoice", complete: activeInvoices.length > 0, to: "/dashboard/invoices" },
        { key: "payment", label: "Record first payment", complete: invoiceTotals[0]?.paidAmount > 0, to: "/dashboard/invoices" },
        { key: "reports", label: "Review reports", complete: activeInvoices.length > 0 || (monthlyExpensesRaw[0]?.totalExpenses || 0) > 0, to: "/dashboard/reports" },
      ],
    },
  });
});

module.exports = {
  getDashboardSummary,
};
