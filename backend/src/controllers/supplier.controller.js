const Supplier = require("../models/Supplier");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const {
  buildPaginatedResponse,
  buildPagination,
  buildSearchFilter,
  buildSort,
} = require("../utils/queryFeatures");

const supplierSortFields = ["supplierName", "email", "paymentStatus", "createdAt", "updatedAt"];

const listSuppliers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query);
  const sort = buildSort(req.query.sortBy, req.query.sortOrder, supplierSortFields);
  const searchFilter = buildSearchFilter(req.query.search, [
    "supplierName",
    "email",
    "phone",
    "gstNumber",
  ]);

  const filters = {
    businessId: req.tenant.businessId,
    ...searchFilter,
  };

  if (req.query.paymentStatus) {
    filters.paymentStatus = req.query.paymentStatus;
  }

  const [items, total] = await Promise.all([
    Supplier.find(filters).populate("productsSupplied", "name sku").sort(sort).skip(skip).limit(limit),
    Supplier.countDocuments(filters),
  ]);

  res.status(200).json({
    message: "Suppliers fetched successfully",
    data: buildPaginatedResponse({ items, total, page, limit }),
  });
});

const getSupplierById = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOne({
    _id: req.params.supplierId,
    businessId: req.tenant.businessId,
  }).populate("productsSupplied", "name sku");

  if (!supplier) {
    throw new AppError("Supplier not found", 404);
  }

  res.status(200).json({
    message: "Supplier fetched successfully",
    data: supplier,
  });
});

const createSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.create({
    businessId: req.tenant.businessId,
    supplierName: req.body.supplierName.trim(),
    phone: req.body.phone?.trim() || "",
    email: req.body.email?.trim().toLowerCase() || "",
    address: req.body.address?.trim() || "",
    gstNumber: req.body.gstNumber?.trim().toUpperCase() || "",
    productsSupplied: Array.isArray(req.body.productsSupplied) ? req.body.productsSupplied : [],
    notes: req.body.notes?.trim() || "",
    paymentStatus: req.body.paymentStatus || "unpaid",
  });

  res.status(201).json({
    message: "Supplier created successfully",
    data: supplier,
  });
});

const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOne({
    _id: req.params.supplierId,
    businessId: req.tenant.businessId,
  });

  if (!supplier) {
    throw new AppError("Supplier not found", 404);
  }

  supplier.supplierName = req.body.supplierName?.trim() || supplier.supplierName;
  supplier.phone = req.body.phone?.trim() || "";
  supplier.email = req.body.email?.trim().toLowerCase() || "";
  supplier.address = req.body.address?.trim() || "";
  supplier.gstNumber = req.body.gstNumber?.trim().toUpperCase() || "";
  supplier.productsSupplied = Array.isArray(req.body.productsSupplied) ? req.body.productsSupplied : [];
  supplier.notes = req.body.notes?.trim() || "";
  supplier.paymentStatus = req.body.paymentStatus || "unpaid";

  await supplier.save();

  res.status(200).json({
    message: "Supplier updated successfully",
    data: supplier,
  });
});

const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOneAndDelete({
    _id: req.params.supplierId,
    businessId: req.tenant.businessId,
  });

  if (!supplier) {
    throw new AppError("Supplier not found", 404);
  }

  res.status(200).json({
    message: "Supplier deleted successfully",
  });
});

module.exports = {
  createSupplier,
  deleteSupplier,
  getSupplierById,
  listSuppliers,
  updateSupplier,
};

