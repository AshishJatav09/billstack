const Invoice = require("../models/Invoice");
const Product = require("../models/Product");
const Purchase = require("../models/Purchase");
const StockMovement = require("../models/StockMovement");
const asyncHandler = require("../utils/asyncHandler");

const getReportsSummary = asyncHandler(async (req, res) => {
  const businessId = req.user.businessId;

  const [
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
  ]);

  const invoiceProfit = profitReport[0][0] || {};
  const purchaseProfit = profitReport[1][0] || {};

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
        grossProfit:
          (invoiceProfit.totalRevenue || 0) - (purchaseProfit.totalPurchases || 0),
      },
    },
  });
});

module.exports = {
  getReportsSummary,
};

