const mongoose = require("mongoose");

const Product = require("../models/Product");
const Purchase = require("../models/Purchase");
const StockMovement = require("../models/StockMovement");
const Supplier = require("../models/Supplier");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const { buildInventoryFlags } = require("../services/inventory.service");
const {
  buildPaginatedResponse,
  buildPagination,
  buildSearchFilter,
  buildSort,
} = require("../utils/queryFeatures");

const purchaseSortFields = ["purchaseDate", "totalAmount", "paidAmount", "createdAt"];

const listPurchases = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query);
  const sort = buildSort(req.query.sortBy, req.query.sortOrder, purchaseSortFields, "-purchaseDate");
  const searchFilter = buildSearchFilter(req.query.search, ["paymentStatus"]);

  const filters = {
    businessId: req.tenant.businessId,
    ...searchFilter,
  };

  if (req.query.supplierId) {
    filters.supplierId = req.query.supplierId;
  }

  if (req.query.paymentStatus) {
    filters.paymentStatus = req.query.paymentStatus;
  }

  const [items, total] = await Promise.all([
    Purchase.find(filters)
      .populate("supplierId", "supplierName")
      .populate("createdBy", "name email")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Purchase.countDocuments(filters),
  ]);

  res.status(200).json({
    message: "Purchases fetched successfully",
    data: buildPaginatedResponse({ items, total, page, limit }),
  });
});

const getPurchaseById = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findOne({
    _id: req.params.purchaseId,
    businessId: req.tenant.businessId,
  })
    .populate("supplierId", "supplierName phone email paymentStatus")
    .populate("createdBy", "name email");

  if (!purchase) {
    throw new AppError("Purchase not found", 404);
  }

  res.status(200).json({
    message: "Purchase fetched successfully",
    data: purchase,
  });
});

const createPurchase = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let createdPurchase;

    await session.withTransaction(async () => {
      const supplier = await Supplier.findOne({
        _id: req.body.supplierId,
        businessId: req.tenant.businessId,
      }).session(session);

      if (!supplier) {
        throw new AppError("Supplier not found", 404);
      }

      const items = Array.isArray(req.body.productsPurchased) ? req.body.productsPurchased : [];

      if (!items.length) {
        throw new AppError("At least one purchased product is required", 400);
      }

      const productIds = items.map((item) => item.productId);
      const products = await Product.find({
        _id: { $in: productIds },
        businessId: req.tenant.businessId,
      }).session(session);

      if (products.length !== productIds.length) {
        throw new AppError("One or more purchased products are invalid", 400);
      }

      const productMap = new Map(products.map((product) => [product._id.toString(), product]));

      const normalizedItems = items.map((item) => {
        const product = productMap.get(item.productId);
        const quantity = Number(item.quantity || 0);
        const purchasePrice = Number(item.purchasePrice || 0);
        const tax = Number(item.tax || 0);
        const discount = Number(item.discount || 0);
        const lineTotal = quantity * purchasePrice + tax - discount;

        if (!product) {
          throw new AppError("Purchased product not found", 400);
        }

        if (quantity <= 0) {
          throw new AppError("Purchase quantity must be greater than zero", 400);
        }

        return {
          productId: product._id,
          productName: product.name,
          quantity,
          purchasePrice,
          tax,
          discount,
          lineTotal,
        };
      });

      const totalAmount = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const paidAmount = Number(req.body.paidAmount || 0);

      createdPurchase = await Purchase.create(
        [
          {
            businessId: req.tenant.businessId,
            supplierId: supplier._id,
            productsPurchased: normalizedItems,
            totalAmount,
            paidAmount,
            paymentStatus: req.body.paymentStatus || (paidAmount >= totalAmount ? "paid" : paidAmount > 0 ? "partial" : "unpaid"),
            purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : new Date(),
            createdBy: req.user._id,
          },
        ],
        { session }
      );

      const purchase = createdPurchase[0];

      for (const item of normalizedItems) {
        const product = productMap.get(item.productId.toString());
        const previousStock = product.currentStock;
        const newStock = previousStock + item.quantity;

        product.currentStock = newStock;
        product.purchasePrice = item.purchasePrice;
        const flags = buildInventoryFlags(product);
        product.isLowStock = flags.isLowStock;
        product.isOutOfStock = flags.isOutOfStock;
        await product.save({ session });

        await StockMovement.create(
          [
            {
              businessId: req.tenant.businessId,
              productId: product._id,
              type: "IN",
              quantity: item.quantity,
              previousStock,
              newStock,
              reason: `Purchase from ${supplier.supplierName}`,
              referenceType: "PURCHASE",
              referenceId: purchase._id.toString(),
              createdBy: req.user._id,
            },
          ],
          { session }
        );
      }

      supplier.productsSupplied = Array.from(
        new Set([
          ...supplier.productsSupplied.map((id) => id.toString()),
          ...normalizedItems.map((item) => item.productId.toString()),
        ])
      );
      supplier.paymentStatus = purchase.paymentStatus;
      await supplier.save({ session });
    });

    const purchase = await Purchase.findById(createdPurchase[0]._id)
      .populate("supplierId", "supplierName")
      .populate("createdBy", "name email");

    res.status(201).json({
      message: "Purchase created successfully",
      data: purchase,
    });
  } finally {
    session.endSession();
  }
});

module.exports = {
  createPurchase,
  getPurchaseById,
  listPurchases,
};

