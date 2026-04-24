const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const { applyStockMovement, buildInventoryFlags } = require("../services/inventory.service");
const {
  buildPaginatedResponse,
  buildPagination,
  buildSearchFilter,
  buildSort,
} = require("../utils/queryFeatures");

const productSortFields = [
  "name",
  "category",
  "sellingPrice",
  "currentStock",
  "createdAt",
  "updatedAt",
];

const listProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query);
  const sort = buildSort(req.query.sortBy, req.query.sortOrder, productSortFields);
  const searchFilter = buildSearchFilter(req.query.search, [
    "name",
    "sku",
    "barcode",
    "category",
    "unitType",
  ]);

  const filters = {
    businessId: req.tenant.businessId,
    ...searchFilter,
  };

  if (req.query.category) {
    filters.category = req.query.category;
  }

  if (req.query.status) {
    filters.status = req.query.status;
  }

  if (req.query.trackInventory === "true") {
    filters.trackInventory = true;
  }

  if (req.query.trackInventory === "false") {
    filters.trackInventory = false;
  }

  if (req.query.lowStock === "true") {
    filters.$expr = { $lte: ["$currentStock", "$minimumStockLevel"] };
  }

  if (req.query.outOfStock === "true") {
    filters.currentStock = { $lte: 0 };
  }

  const [items, total] = await Promise.all([
    Product.find(filters).sort(sort).skip(skip).limit(limit),
    Product.countDocuments(filters),
  ]);

  res.status(200).json({
    message: "Products fetched successfully",
    data: buildPaginatedResponse({ items, total, page, limit }),
  });
});

const getProductById = asyncHandler(async (req, res) => {
  const [product, stockHistory] = await Promise.all([
    Product.findOne({
      _id: req.params.productId,
      businessId: req.tenant.businessId,
    }),
    StockMovement.find({
      businessId: req.tenant.businessId,
      productId: req.params.productId,
    })
      .sort("-createdAt")
      .limit(20),
  ]);

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  res.status(200).json({
    message: "Product fetched successfully",
    data: {
      product,
      stockHistory,
    },
  });
});

const createProduct = asyncHandler(async (req, res) => {
  const openingStock = Number(req.body.openingStock ?? req.body.currentStock ?? 0);
  const product = await Product.create({
    businessId: req.tenant.businessId,
    name: req.body.name.trim(),
    sku: req.body.sku?.trim().toUpperCase() || "",
    barcode: req.body.barcode?.trim() || "",
    category: req.body.category?.trim() || "",
    unitType: req.body.unitType?.trim() || "unit",
    purchasePrice: Number(req.body.purchasePrice || 0),
    sellingPrice: Number(req.body.sellingPrice || 0),
    taxRate: Number(req.body.taxRate || 0),
    discount: Number(req.body.discount || 0),
    currentStock: openingStock,
    openingStock,
    minimumStockLevel: Number(req.body.minimumStockLevel || 0),
    trackInventory: req.body.trackInventory !== false && req.body.trackInventory !== "false",
    status: req.body.status || "active",
    ...buildInventoryFlags({
      currentStock: openingStock,
      minimumStockLevel: Number(req.body.minimumStockLevel || 0),
      trackInventory: req.body.trackInventory !== false && req.body.trackInventory !== "false",
    }),
  });

  if (product.trackInventory && openingStock !== 0) {
    await StockMovement.create({
      businessId: req.tenant.businessId,
      productId: product._id,
      type: "OPENING",
      quantity: openingStock,
      previousStock: 0,
      newStock: openingStock,
      reason: "Opening stock",
      referenceType: "MANUAL",
      referenceId: "",
      createdBy: req.user._id,
    });
  }

  res.status(201).json({
    message: "Product created successfully",
    data: product,
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.productId,
    businessId: req.tenant.businessId,
  });

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  product.name = req.body.name?.trim() || product.name;
  product.sku = req.body.sku?.trim().toUpperCase() || "";
  product.barcode = req.body.barcode?.trim() || "";
  product.category = req.body.category?.trim() || "";
  product.unitType = req.body.unitType?.trim() || "unit";
  product.purchasePrice = Number(req.body.purchasePrice || 0);
  product.sellingPrice = Number(req.body.sellingPrice || 0);
  product.taxRate = Number(req.body.taxRate || 0);
  product.discount = Number(req.body.discount || 0);
  product.minimumStockLevel = Number(req.body.minimumStockLevel || 0);
  product.trackInventory =
    req.body.trackInventory !== false && req.body.trackInventory !== "false";
  product.status = req.body.status || "active";
  const flags = buildInventoryFlags(product);
  product.isLowStock = flags.isLowStock;
  product.isOutOfStock = flags.isOutOfStock;

  await product.save();

  res.status(200).json({
    message: "Product updated successfully",
    data: product,
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOneAndDelete({
    _id: req.params.productId,
    businessId: req.tenant.businessId,
  });

  if (!product) {
    throw new AppError("Product not found", 404);
  }

  res.status(200).json({
    message: "Product deleted successfully",
  });
});

const getProductMovements = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query);
  const sort = buildSort(req.query.sortBy, req.query.sortOrder, ["createdAt", "type", "quantity"], "-createdAt");
  const filters = {
    businessId: req.tenant.businessId,
    productId: req.params.productId,
  };

  if (req.query.type) {
    filters.type = req.query.type;
  }

  const [items, total] = await Promise.all([
    StockMovement.find(filters).populate("createdBy", "name email").sort(sort).skip(skip).limit(limit),
    StockMovement.countDocuments(filters),
  ]);

  res.status(200).json({
    message: "Stock movements fetched successfully",
    data: buildPaginatedResponse({ items, total, page, limit }),
  });
});

const createProductMovement = asyncHandler(async (req, res) => {
  const { movement, product } = await applyStockMovement({
    businessId: req.tenant.businessId,
    productId: req.params.productId,
    type: req.body.type,
    quantity: req.body.quantity,
    reason: req.body.reason,
    referenceType: req.body.referenceType,
    referenceId: req.body.referenceId,
    createdBy: req.user._id,
  });

  res.status(201).json({
    message: "Stock movement recorded successfully",
    data: {
      movement,
      product,
    },
  });
});

module.exports = {
  createProduct,
  createProductMovement,
  deleteProduct,
  getProductById,
  getProductMovements,
  listProducts,
  updateProduct,
};
