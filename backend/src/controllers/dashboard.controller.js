const Invoice = require("../models/Invoice");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const asyncHandler = require("../utils/asyncHandler");

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
    invoiceTotals,
    monthlyRevenueRaw,
    invoiceStatusRaw,
    topSellingProductsRaw,
    recentInvoices,
    recentStockMovements,
    lowStockProducts,
    outOfStockProducts,
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
  ]);

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
      },
      topSellingProducts: topSellingProductsRaw,
      recentInvoices,
      recentStockMovements,
      lowStockProducts,
      outOfStockProducts,
      revenueChart,
      invoiceStatusChart: invoiceStatusRaw.map((item) => ({
        status: item._id || "unknown",
        count: item.count,
        amount: item.amount,
      })),
    },
  });
});

module.exports = {
  getDashboardSummary,
};

