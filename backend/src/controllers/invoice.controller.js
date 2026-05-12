const mongoose = require("mongoose");

const Business = require("../models/Business");
const Customer = require("../models/Customer");
const Invoice = require("../models/Invoice");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const { sendInvoiceEmail } = require("../services/email.service");
const { buildInventoryFlags } = require("../services/inventory.service");
const { generateInvoicePdfBuffer } = require("../utils/pdfInvoice");
const { buildInvoiceNumber, buildInvoiceTotals } = require("../utils/invoice");
const {
  buildPaginatedResponse,
  buildPagination,
  buildSearchFilter,
  buildSort,
} = require("../utils/queryFeatures");

const invoiceSortFields = ["invoiceDate", "dueDate", "grandTotal", "createdAt"];

const getInvoiceForSharing = async ({ invoiceId, businessId }) => {
  const [invoice, business] = await Promise.all([
    Invoice.findOne({
      _id: invoiceId,
      businessId,
    })
      .populate("customerId", "name email phone billingAddress shippingAddress gstNumber")
      .populate("createdBy", "name email"),
    Business.findById(businessId),
  ]);

  if (!invoice || !business) {
    throw new AppError("Invoice not found", 404);
  }

  return { invoice, business };
};

const syncCustomerInvoiceHistory = async ({ customer, businessId, session }) => {
  const invoices = await Invoice.find({
    businessId,
    customerId: customer._id,
    status: { $ne: "cancelled" },
  })
    .sort("-invoiceDate")
    .session(session);

  customer.invoiceHistory = invoices.map((invoice) => ({
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.grandTotal,
    status: invoice.paymentStatus,
    issuedAt: invoice.invoiceDate,
  }));

  await customer.save({ session });
};

const applyInvoiceStockDelta = async ({
  business,
  businessId,
  invoiceId,
  previousItems,
  nextItems,
  createdBy,
  session,
}) => {
  const previousMap = new Map();
  const nextMap = new Map();

  previousItems.forEach((item) => {
    previousMap.set(item.productId.toString(), item);
  });

  nextItems.forEach((item) => {
    nextMap.set(item.productId.toString(), item);
  });

  const productIds = Array.from(new Set([...previousMap.keys(), ...nextMap.keys()]));
  const products = await Product.find({
    _id: { $in: productIds },
    businessId,
  }).session(session);

  const productMap = new Map(products.map((product) => [product._id.toString(), product]));

  for (const productId of productIds) {
    const previousQuantity = Number(previousMap.get(productId)?.quantity || 0);
    const nextQuantity = Number(nextMap.get(productId)?.quantity || 0);
    const delta = nextQuantity - previousQuantity;

    if (delta === 0) {
      continue;
    }

    const product = productMap.get(productId);

    if (!product) {
      throw new AppError("Invoice product not found", 400);
    }

    if (!product.trackInventory) {
      continue;
    }

    const previousStock = product.currentStock;
    const newStock = previousStock - delta;

    if (!business.inventorySettings?.allowNegativeStock && newStock < 0) {
      throw new AppError(`Insufficient stock for ${product.name}`, 403);
    }

    product.currentStock = newStock;
    const flags = buildInventoryFlags(product);
    product.isLowStock = flags.isLowStock;
    product.isOutOfStock = flags.isOutOfStock;
    await product.save({ session });

    await StockMovement.create(
      [
        {
          businessId,
          productId: product._id,
          type: delta > 0 ? "OUT" : "RETURN",
          quantity: Math.abs(delta),
          previousStock,
          newStock,
          reason: `Invoice ${delta > 0 ? "issue" : "adjustment restore"} for ${invoiceId}`,
          referenceType: "INVOICE",
          referenceId: invoiceId.toString(),
          createdBy,
        },
      ],
      { session }
    );
  }
};

const buildInvoiceLineItems = ({ items, products }) => {
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));

  return items.map((item) => {
    const product = productMap.get(item.productId);

    if (!product) {
      throw new AppError("One or more invoice products are invalid", 400);
    }

    return {
      productId: product._id,
      productName: product.name,
      quantity: Number(item.quantity || 0),
      rate: Number(item.rate ?? product.sellingPrice ?? 0),
      taxRate: Number(item.taxRate ?? item.tax ?? product.taxRate ?? 0),
      discountType: item.discountType === "amount" ? "amount" : "percent",
      discountValue: Number(
        item.discountValue !== undefined ? item.discountValue : item.discount ?? product.discount ?? 0
      ),
    };
  });
};

const listInvoices = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query);
  const sort = buildSort(req.query.sortBy, req.query.sortOrder, invoiceSortFields, "-invoiceDate");
  const searchFilter = buildSearchFilter(req.query.search, ["invoiceNumber", "paymentStatus", "status"]);
  const filters = {
    businessId: req.tenant.businessId,
    ...searchFilter,
  };

  if (req.query.customerId) {
    filters.customerId = req.query.customerId;
  }

  if (req.query.paymentStatus) {
    filters.paymentStatus = req.query.paymentStatus;
  }

  if (req.query.status) {
    filters.status = req.query.status;
  }

  const [items, total] = await Promise.all([
    Invoice.find(filters)
      .populate("customerId", "name email phone")
      .populate("createdBy", "name email")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Invoice.countDocuments(filters),
  ]);

  res.status(200).json({
    message: "Invoices fetched successfully",
    data: buildPaginatedResponse({ items, total, page, limit }),
  });
});

const getInvoiceById = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({
    _id: req.params.invoiceId,
    businessId: req.tenant.businessId,
  })
    .populate("customerId", "name email phone billingAddress shippingAddress gstNumber")
    .populate("createdBy", "name email");

  if (!invoice) {
    throw new AppError("Invoice not found", 404);
  }

  res.status(200).json({
    message: "Invoice fetched successfully",
    data: invoice,
  });
});

const createInvoice = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let createdInvoiceId;

    await session.withTransaction(async () => {
      const business = await Business.findById(req.tenant.businessId).session(session);
      const customer = await Customer.findOne({
        _id: req.body.customerId,
        businessId: req.tenant.businessId,
      }).session(session);

      if (!business) {
        throw new AppError("Business not found", 404);
      }

      if (!customer) {
        throw new AppError("Customer not found", 404);
      }

      const rawItems = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];

      if (!rawItems.length) {
        throw new AppError("At least one invoice line item is required", 400);
      }

      const products = await Product.find({
        _id: { $in: rawItems.map((item) => item.productId) },
        businessId: req.tenant.businessId,
      }).session(session);

      const normalizedItems = buildInvoiceLineItems({ items: rawItems, products });
      const totals = buildInvoiceTotals({
        lineItems: normalizedItems,
        shippingCharges: req.body.shippingCharges,
        roundOff: req.body.roundOff,
        amountPaid: req.body.amountPaid,
      });

      const sequence = business.invoiceNumbering?.nextSequence || 1;
      const invoiceDate = req.body.invoiceDate ? new Date(req.body.invoiceDate) : new Date();
      const invoiceNumber = buildInvoiceNumber({
        prefix: business.invoiceNumbering?.prefix,
        format: business.invoiceNumbering?.format,
        sequence,
        date: invoiceDate,
      });

      const created = await Invoice.create(
        [
          {
            businessId: req.tenant.businessId,
            customerId: customer._id,
            invoiceNumber,
            invoiceDate,
            dueDate: req.body.dueDate ? new Date(req.body.dueDate) : invoiceDate,
            customerDetails: {
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              address: customer.billingAddress,
              gstNumber: customer.gstNumber,
            },
            businessDetails: {
              name: business.name,
              email: business.email || business.billingEmail,
              phone: business.phone,
              address: business.address,
              gstNumber: business.gstTaxId,
            },
            lineItems: totals.lineItems,
            subtotal: totals.subtotal,
            totalTax: totals.totalTax,
            totalDiscount: totals.totalDiscount,
            shippingCharges: totals.shippingCharges,
            roundOff: totals.roundOff,
            grandTotal: totals.grandTotal,
            amountPaid: totals.amountPaid,
            balanceDue: totals.balanceDue,
            paymentStatus: totals.paymentStatus,
            notes: req.body.notes?.trim() || "",
            termsAndConditions: req.body.termsAndConditions?.trim() || "",
            status: "issued",
            createdBy: req.user._id,
          },
        ],
        { session }
      );

      const invoice = created[0];
      createdInvoiceId = invoice._id;
      business.invoiceNumbering.nextSequence = sequence + 1;
      await business.save({ session });

      await applyInvoiceStockDelta({
        business,
        businessId: req.tenant.businessId,
        invoiceId: invoice._id,
        previousItems: [],
        nextItems: totals.lineItems,
        createdBy: req.user._id,
        session,
      });

      await syncCustomerInvoiceHistory({
        customer,
        businessId: req.tenant.businessId,
        session,
      });
    });

    const invoice = await Invoice.findById(createdInvoiceId)
      .populate("customerId", "name email phone")
      .populate("createdBy", "name email");

    res.status(201).json({
      message: "Invoice created successfully",
      data: invoice,
    });
  } finally {
    session.endSession();
  }
});

const updateInvoice = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const invoice = await Invoice.findOne({
        _id: req.params.invoiceId,
        businessId: req.tenant.businessId,
      }).session(session);

      if (!invoice) {
        throw new AppError("Invoice not found", 404);
      }

      if (invoice.status === "cancelled") {
        throw new AppError("Cancelled invoices cannot be edited", 400);
      }

      const previousCustomerId = invoice.customerId.toString();
      const business = await Business.findById(req.tenant.businessId).session(session);
      const customer = await Customer.findOne({
        _id: req.body.customerId || invoice.customerId,
        businessId: req.tenant.businessId,
      }).session(session);

      if (!business || !customer) {
        throw new AppError("Business or customer not found", 404);
      }

      const rawItems = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];

      if (!rawItems.length) {
        throw new AppError("At least one invoice line item is required", 400);
      }

      const products = await Product.find({
        _id: { $in: rawItems.map((item) => item.productId) },
        businessId: req.tenant.businessId,
      }).session(session);

      const normalizedItems = buildInvoiceLineItems({ items: rawItems, products });
      const totals = buildInvoiceTotals({
        lineItems: normalizedItems,
        shippingCharges: req.body.shippingCharges,
        roundOff: req.body.roundOff,
        amountPaid: req.body.amountPaid,
      });

      const previousItems = invoice.lineItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      invoice.customerId = customer._id;
      invoice.invoiceDate = req.body.invoiceDate ? new Date(req.body.invoiceDate) : invoice.invoiceDate;
      invoice.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : invoice.dueDate;
      invoice.customerDetails = {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.billingAddress,
        gstNumber: customer.gstNumber,
      };
      invoice.businessDetails = {
        name: business.name,
        email: business.email || business.billingEmail,
        phone: business.phone,
        address: business.address,
        gstNumber: business.gstTaxId,
      };
      invoice.lineItems = totals.lineItems;
      invoice.subtotal = totals.subtotal;
      invoice.totalTax = totals.totalTax;
      invoice.totalDiscount = totals.totalDiscount;
      invoice.shippingCharges = totals.shippingCharges;
      invoice.roundOff = totals.roundOff;
      invoice.grandTotal = totals.grandTotal;
      invoice.amountPaid = totals.amountPaid;
      invoice.balanceDue = totals.balanceDue;
      invoice.paymentStatus = totals.paymentStatus;
      invoice.notes = req.body.notes?.trim() || "";
      invoice.termsAndConditions = req.body.termsAndConditions?.trim() || "";

      await applyInvoiceStockDelta({
        business,
        businessId: req.tenant.businessId,
        invoiceId: invoice._id,
        previousItems,
        nextItems: totals.lineItems,
        createdBy: req.user._id,
        session,
      });

      await invoice.save({ session });
      await syncCustomerInvoiceHistory({
        customer,
        businessId: req.tenant.businessId,
        session,
      });

      if (previousCustomerId !== customer._id.toString()) {
        const previousCustomer = await Customer.findOne({
          _id: previousCustomerId,
          businessId: req.tenant.businessId,
        }).session(session);

        if (previousCustomer) {
          await syncCustomerInvoiceHistory({
            customer: previousCustomer,
            businessId: req.tenant.businessId,
            session,
          });
        }
      }
    });

    const invoice = await Invoice.findById(req.params.invoiceId)
      .populate("customerId", "name email phone")
      .populate("createdBy", "name email");

    res.status(200).json({
      message: "Invoice updated successfully",
      data: invoice,
    });
  } finally {
    session.endSession();
  }
});

const cancelInvoice = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const invoice = await Invoice.findOne({
        _id: req.params.invoiceId,
        businessId: req.tenant.businessId,
      }).session(session);

      if (!invoice) {
        throw new AppError("Invoice not found", 404);
      }

      if (invoice.status === "cancelled") {
        throw new AppError("Invoice is already cancelled", 400);
      }

      const business = await Business.findById(req.tenant.businessId).session(session);
      const customer = await Customer.findOne({
        _id: invoice.customerId,
        businessId: req.tenant.businessId,
      }).session(session);

      await applyInvoiceStockDelta({
        business,
        businessId: req.tenant.businessId,
        invoiceId: invoice._id,
        previousItems: invoice.lineItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        nextItems: [],
        createdBy: req.user._id,
        session,
      });

      invoice.status = "cancelled";
      invoice.paymentStatus = "cancelled";
      invoice.balanceDue = 0;
      await invoice.save({ session });

      if (customer) {
        await syncCustomerInvoiceHistory({
          customer,
          businessId: req.tenant.businessId,
          session,
        });
      }
    });

    res.status(200).json({
      message: "Invoice cancelled successfully",
    });
  } finally {
    session.endSession();
  }
});

const downloadInvoicePdf = asyncHandler(async (req, res) => {
  const { invoice, business } = await getInvoiceForSharing({
    invoiceId: req.params.invoiceId,
    businessId: req.tenant.businessId,
  });

  const pdfBuffer = await generateInvoicePdfBuffer({ invoice, business });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${req.query.download === "true" ? "attachment" : "inline"}; filename="${invoice.invoiceNumber}.pdf"`
  );
  res.send(pdfBuffer);
});

const emailInvoicePdf = asyncHandler(async (req, res) => {
  const { invoice, business } = await getInvoiceForSharing({
    invoiceId: req.params.invoiceId,
    businessId: req.tenant.businessId,
  });

  const toEmail = req.body.toEmail || invoice.customerDetails.email;

  if (!toEmail) {
    throw new AppError("Recipient email is required", 400);
  }

  const pdfBuffer = await generateInvoicePdfBuffer({ invoice, business });

  await sendInvoiceEmail({
    to: toEmail,
    subject: `Invoice ${invoice.invoiceNumber} from ${business.name}`,
    html: `
      <p>Hello,</p>
      <p>Please find attached invoice <strong>${invoice.invoiceNumber}</strong>.</p>
      <p>Total: ${invoice.grandTotal.toFixed(2)}</p>
      <p>Payment status: ${invoice.paymentStatus}</p>
      <p>Regards,<br/>${business.name}</p>
    `,
    pdfBuffer,
    filename: `${invoice.invoiceNumber}.pdf`,
  });

  res.status(200).json({
    message: "Invoice emailed successfully",
  });
});

module.exports = {
  cancelInvoice,
  createInvoice,
  downloadInvoicePdf,
  emailInvoicePdf,
  getInvoiceById,
  listInvoices,
  updateInvoice,
};
