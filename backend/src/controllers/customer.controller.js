const Customer = require("../models/Customer");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const {
  buildPaginatedResponse,
  buildPagination,
  buildSearchFilter,
  buildSort,
} = require("../utils/queryFeatures");

const customerSortFields = ["name", "email", "phone", "createdAt", "updatedAt"];

const listCustomers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query);
  const sort = buildSort(req.query.sortBy, req.query.sortOrder, customerSortFields);
  const searchFilter = buildSearchFilter(req.query.search, [
    "name",
    "email",
    "phone",
    "gstNumber",
  ]);

  const filters = {
    businessId: req.tenant.businessId,
    ...searchFilter,
  };

  if (req.query.gstStatus === "with-gst") {
    filters.gstNumber = { $ne: "" };
  }

  if (req.query.gstStatus === "without-gst") {
    filters.gstNumber = "";
  }

  const [items, total] = await Promise.all([
    Customer.find(filters).sort(sort).skip(skip).limit(limit),
    Customer.countDocuments(filters),
  ]);

  res.status(200).json({
    message: "Customers fetched successfully",
    data: buildPaginatedResponse({ items, total, page, limit }),
  });
});

const getCustomerById = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({
    _id: req.params.customerId,
    businessId: req.tenant.businessId,
  });

  if (!customer) {
    throw new AppError("Customer not found", 404);
  }

  res.status(200).json({
    message: "Customer fetched successfully",
    data: customer,
  });
});

const createCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.create({
    businessId: req.tenant.businessId,
    name: req.body.name.trim(),
    phone: req.body.phone?.trim() || "",
    email: req.body.email?.trim().toLowerCase() || "",
    billingAddress: req.body.billingAddress?.trim() || "",
    shippingAddress: req.body.shippingAddress?.trim() || "",
    gstNumber: req.body.gstNumber?.trim().toUpperCase() || "",
    notes: req.body.notes?.trim() || "",
    invoiceHistory: Array.isArray(req.body.invoiceHistory) ? req.body.invoiceHistory : [],
  });

  res.status(201).json({
    message: "Customer created successfully",
    data: customer,
  });
});

const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({
    _id: req.params.customerId,
    businessId: req.tenant.businessId,
  });

  if (!customer) {
    throw new AppError("Customer not found", 404);
  }

  customer.name = req.body.name?.trim() || customer.name;
  customer.phone = req.body.phone?.trim() || "";
  customer.email = req.body.email?.trim().toLowerCase() || "";
  customer.billingAddress = req.body.billingAddress?.trim() || "";
  customer.shippingAddress = req.body.shippingAddress?.trim() || "";
  customer.gstNumber = req.body.gstNumber?.trim().toUpperCase() || "";
  customer.notes = req.body.notes?.trim() || "";

  if (Array.isArray(req.body.invoiceHistory)) {
    customer.invoiceHistory = req.body.invoiceHistory;
  }

  await customer.save();

  res.status(200).json({
    message: "Customer updated successfully",
    data: customer,
  });
});

const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOneAndDelete({
    _id: req.params.customerId,
    businessId: req.tenant.businessId,
  });

  if (!customer) {
    throw new AppError("Customer not found", 404);
  }

  res.status(200).json({
    message: "Customer deleted successfully",
  });
});

module.exports = {
  createCustomer,
  deleteCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
};

