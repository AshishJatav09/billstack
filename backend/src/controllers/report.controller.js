const Invoice = require("../models/Invoice");
const Expense = require("../models/Expense");
const Product = require("../models/Product");
const Purchase = require("../models/Purchase");
const StockMovement = require("../models/StockMovement");
const asyncHandler = require("../utils/asyncHandler");
const { getDerivedInvoiceRows, getDerivedPurchaseRows } = require("../services/financial-read.service");

const getReportsSummary = asyncHandler(async (req, res) => {
  const businessId = req.user.businessId;

  let [
    dailySales,
    monthlySales,
    customerWiseSales,
    productWiseSales,
    taxReport,
    inventoryValuation,
    stockMovement,
    purchaseReport,
    pendingPayment,
    profitReport,
    expenseSummary,
  ] = await Promise.all([
    Invoice.aggregate([
      { $match: { businessId, status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: {
            year: { $year: "$invoiceDate" },
            month: { $month: "$invoiceDate" },
            day: { $dayOfMonth: "$invoiceDate" },
          },
          totalSales: { $sum: "$grandTotal" },
          totalInvoices: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } },
      { $limit: 30 },
    ]),
    Invoice.aggregate([
      { $match: { businessId, status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: {
            year: { $year: "$invoiceDate" },
            month: { $month: "$invoiceDate" },
          },
          totalSales: { $sum: "$grandTotal" },
          paidAmount: { $sum: "$amountPaid" },
          balanceDue: { $sum: "$balanceDue" },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 },
    ]),
    Invoice.aggregate([
      { $match: { businessId, status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: "$customerDetails.name",
          totalSales: { $sum: "$grandTotal" },
          paidAmount: { $sum: "$amountPaid" },
          balanceDue: { $sum: "$balanceDue" },
          invoiceCount: { $sum: 1 },
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: 20 },
    ]),
    Invoice.aggregate([
      { $match: { businessId, status: { $ne: "cancelled" } } },
      { $unwind: "$lineItems" },
      {
        $group: {
          _id: "$lineItems.productName",
          quantitySold: { $sum: "$lineItems.quantity" },
          revenue: { $sum: "$lineItems.itemTotal" },
          tax: { $sum: "$lineItems.tax" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 25 },
    ]),
    Invoice.aggregate([
      { $match: { businessId, status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: null,
          totalTaxCollected: { $sum: "$totalTax" },
          totalDiscountGiven: { $sum: "$totalDiscount" },
          taxableSales: { $sum: "$subtotal" },
        },
      },
    ]),
    Product.aggregate([
      { $match: { businessId } },
      {
        $project: {
          name: 1,
          currentStock: 1,
          purchasePrice: 1,
          sellingPrice: 1,
          valuationAtCost: { $multiply: ["$currentStock", "$purchasePrice"] },
          valuationAtSelling: { $multiply: ["$currentStock", "$sellingPrice"] },
        },
      },
      { $sort: { valuationAtCost: -1 } },
    ]),
    StockMovement.find({ businessId })
      .populate("productId", "name sku")
      .populate("createdBy", "name")
      .sort("-createdAt")
      .limit(100),
    Purchase.find({ businessId })
      .populate("supplierId", "supplierName")
      .populate("createdBy", "name")
      .sort("-purchaseDate")
      .limit(50),
    Invoice.find({
      businessId,
      balanceDue: { $gt: 0 },
      status: { $ne: "cancelled" },
    })
      .populate("customerId", "name email phone")
      .sort("-balanceDue")
      .limit(50),
    Promise.all([
      Invoice.aggregate([
        { $match: { businessId, status: { $ne: "cancelled" } } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$grandTotal" },
            totalTaxCollected: { $sum: "$totalTax" },
          },
        },
      ]),
      Purchase.aggregate([
        { $match: { businessId } },
        {
          $group: {
            _id: null,
            totalPurchases: { $sum: "$totalAmount" },
            totalPurchaseTax: { $sum: { $sum: "$productsPurchased.tax" } },
          },
        },
      ]),
    ]),
    Expense.aggregate([
      { $match: { businessId, status: { $ne: "CANCELLED" } } },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$totalAmount" },
          gstRecorded: { $sum: "$taxAmount" },
          paid: { $sum: { $ifNull: ["$paidAmount", { $cond: [{ $eq: ["$paymentStatus", "PAID"] }, "$totalAmount", 0] }] } },
          unpaid: {
            $sum: {
              $ifNull: [
                "$balanceAmount",
                {
                  $cond: [
                    { $gt: [{ $subtract: ["$totalAmount", { $ifNull: ["$paidAmount", 0] }] }, 0] },
                    { $subtract: ["$totalAmount", { $ifNull: ["$paidAmount", 0] }] },
                    0,
                  ],
                },
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]),
  ]);

  const derivedInvoices = (await getDerivedInvoiceRows({ businessId, filter: {} })).filter((invoice) => invoice.status !== "cancelled");
  const monthMap = new Map(); const customerMap = new Map();
  derivedInvoices.forEach((invoice) => {
    const monthKey = `${new Date(invoice.invoiceDate).getFullYear()}-${new Date(invoice.invoiceDate).getMonth() + 1}`;
    const month = monthMap.get(monthKey) || { _id: { year: new Date(invoice.invoiceDate).getFullYear(), month: new Date(invoice.invoiceDate).getMonth() + 1 }, totalSales: 0, paidAmount: 0, balanceDue: 0 };
    month.totalSales += Number(invoice.grandTotal || 0); month.paidAmount += Number(invoice.amountPaid || 0); month.balanceDue += Number(invoice.balanceDue || 0); monthMap.set(monthKey, month);
    const customerKey = invoice.customerDetails?.name || invoice.customerId?.name || String(invoice.customerId || "Unknown");
    const customer = customerMap.get(customerKey) || { _id: customerKey, totalSales: 0, paidAmount: 0, balanceDue: 0, invoiceCount: 0 };
    customer.totalSales += Number(invoice.grandTotal || 0); customer.paidAmount += Number(invoice.amountPaid || 0); customer.balanceDue += Number(invoice.balanceDue || 0); customer.invoiceCount += 1; customerMap.set(customerKey, customer);
  });
  monthlySales = Array.from(monthMap.values()).sort((a, b) => b._id.year - a._id.year || b._id.month - a._id.month).slice(0, 12);
  customerWiseSales = Array.from(customerMap.values()).sort((a, b) => b.totalSales - a.totalSales).slice(0, 20);
  pendingPayment = derivedInvoices.filter((invoice) => Number(invoice.balanceDue || 0) > 0).sort((a, b) => Number(b.balanceDue || 0) - Number(a.balanceDue || 0)).slice(0, 50);
  purchaseReport = await getDerivedPurchaseRows({ businessId, filter: {} });

  const invoiceProfit = profitReport[0][0] || {};
  const purchaseProfit = profitReport[1][0] || {};
  const totalExpenses = expenseSummary.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const totalExpenseGstRecorded = expenseSummary.reduce((sum, row) => sum + Number(row.gstRecorded || 0), 0);
  const totalPaidExpenses = expenseSummary.reduce((sum, row) => sum + Number(row.paid || 0), 0);
  const totalUnpaidExpenses = expenseSummary.reduce((sum, row) => sum + Number(row.unpaid || 0), 0);

  res.status(200).json({
    message: "Reports fetched successfully",
    data: {
      dailySales,
      monthlySales,
      customerWiseSales,
      productWiseSales,
      taxReport: taxReport[0] || {
        totalTaxCollected: 0,
        totalDiscountGiven: 0,
        taxableSales: 0,
      },
      inventoryValuation,
      stockMovement,
      purchaseReport,
      pendingPayment,
      profitReport: {
        totalRevenue: invoiceProfit.totalRevenue || 0,
        totalTaxCollected: invoiceProfit.totalTaxCollected || 0,
        totalPurchases: purchaseProfit.totalPurchases || 0,
        totalPurchaseTax: purchaseProfit.totalPurchaseTax || 0,
        totalExpenses,
        netOperatingDifference: (invoiceProfit.totalRevenue || 0) - totalExpenses,
        grossProfit:
          (invoiceProfit.totalRevenue || 0) - (purchaseProfit.totalPurchases || 0),
      },
      expenseReport: {
        totalExpenses,
        totalExpenseGstRecorded,
        totalPaidExpenses,
        totalUnpaidExpenses,
        categoryWiseExpenses: expenseSummary,
      },
    },
  });
});

module.exports = {
  getReportsSummary,
};
