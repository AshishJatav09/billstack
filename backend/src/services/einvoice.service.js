const Business = require("../models/Business");
const Customer = require("../models/Customer");
const EInvoiceMetadata = require("../models/EInvoiceMetadata");
const Invoice = require("../models/Invoice");
const AppError = require("../utils/appError");
const { validateGstin, validateStateCode } = require("../utils/gst");

const VALID_TRANSITIONS = {
  NOT_REQUIRED: ["READY"],
  READY: ["SUBMISSION_PENDING", "FAILED", "CANCELLED"],
  SUBMISSION_PENDING: ["GENERATED", "FAILED", "CANCELLED"],
  GENERATED: ["CANCELLED"],
  FAILED: ["READY", "SUBMISSION_PENDING"],
  CANCELLED: [],
};

const normalizeGstin = (value) => String(value || "").trim().toUpperCase();
const normalizeCode = (value) => String(value || "").trim();
const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const addError = (errors, code, message) => {
  errors.push({ code, message });
};

const getInvoiceBundle = async ({ businessId, invoiceId, session }) => {
  const [invoice, business] = await Promise.all([
    Invoice.findOne({ _id: invoiceId, businessId })
      .populate("customerId", "name email phone billingAddress shippingAddress gstNumber stateCode placeOfSupplyCode")
      .session(session),
    Business.findById(businessId).session(session),
  ]);

  if (!invoice || !business) {
    throw new AppError("Invoice not found", 404);
  }

  return { invoice, business, customer: invoice.customerId };
};

const assessInvoiceReadiness = ({ invoice, business, customer }) => {
  const errors = [];

  if (invoice.status === "cancelled") {
    addError(errors, "NOT_ELIGIBLE", "Cancelled invoices cannot be prepared for e-invoicing.");
  }

  if (!invoice.gstSnapshot) {
    addError(errors, "INVALID_GST_DATA", "Invoice does not have a GST snapshot.");
  }

  const snapshot = invoice.gstSnapshot || {};
  const sellerGstin = normalizeGstin(snapshot.gstin || business.gstConfiguration?.gstin || business.gstTaxId);
  const buyerGstin = normalizeGstin(invoice.customerDetails?.gstNumber || customer?.gstNumber);
  const sellerState = normalizeCode(snapshot.supplierStateCode || business.gstConfiguration?.stateCode);
  const placeOfSupply = normalizeCode(snapshot.placeOfSupplyCode || customer?.placeOfSupplyCode || customer?.stateCode);

  if (!sellerGstin) addError(errors, "MISSING_GSTIN", "Seller GSTIN is required.");
  else if (!validateGstin(sellerGstin)) addError(errors, "MISSING_GSTIN", "Seller GSTIN is invalid.");

  if (!buyerGstin) addError(errors, "MISSING_GSTIN", "Buyer GSTIN is required for e-invoice readiness.");
  else if (!validateGstin(buyerGstin)) addError(errors, "MISSING_GSTIN", "Buyer GSTIN is invalid.");

  if (!sellerState || !validateStateCode(sellerState)) addError(errors, "INVALID_PLACE_OF_SUPPLY", "Seller state code is invalid.");
  if (!placeOfSupply || !validateStateCode(placeOfSupply)) addError(errors, "INVALID_PLACE_OF_SUPPLY", "Place of supply state code is invalid.");

  if (!invoice.invoiceNumber || !invoice.invoiceDate) {
    addError(errors, "INVALID_GST_DATA", "Invoice number and date are required.");
  }

  const snapshotLines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
  if (!snapshotLines.length) {
    addError(errors, "INVALID_GST_DATA", "GST line snapshots are missing.");
  }

  snapshotLines.forEach((line, index) => {
    if (!line.hsnSac) addError(errors, "INVALID_HSN_SAC", `Line ${index + 1} is missing HSN/SAC.`);
    if (!Number.isFinite(Number(line.taxableValue)) || Number(line.taxableValue) < 0) {
      addError(errors, "INVALID_GST_DATA", `Line ${index + 1} has invalid taxable value.`);
    }
    if (!Number.isFinite(Number(line.rate)) || Number(line.rate) < 0 || Number(line.rate) > 100) {
      addError(errors, "INVALID_GST_DATA", `Line ${index + 1} has invalid GST rate.`);
    }
  });

  const expectedTax = roundMoney(Number(invoice.totalTax || 0));
  const snapshotTax = roundMoney(Number(snapshot.totalTax ?? (Number(snapshot.cgst || 0) + Number(snapshot.sgst || 0) + Number(snapshot.utgst || 0) + Number(snapshot.igst || 0))));
  if (expectedTax !== snapshotTax) {
    addError(errors, "TOTAL_MISMATCH", "Invoice tax total does not match stored GST snapshot.");
  }

  const expectedTotal = roundMoney(Number(invoice.grandTotal || 0));
  const recomposedTotal = roundMoney(Number(invoice.subtotal || 0) - Number(invoice.totalDiscount || 0) + snapshotTax + Number(invoice.shippingCharges || 0) + Number(invoice.roundOff || 0));
  if (expectedTotal !== recomposedTotal) {
    addError(errors, "TOTAL_MISMATCH", "Invoice grand total does not reconcile with GST snapshot.");
  }

  const intraState = sellerState && placeOfSupply && sellerState === placeOfSupply;
  if (intraState && Number(snapshot.igst || 0) > 0) {
    addError(errors, "INVALID_GST_DATA", "Intra-state invoice cannot contain IGST.");
  }
  if (!intraState && (Number(snapshot.cgst || 0) > 0 || Number(snapshot.sgst || 0) > 0)) {
    addError(errors, "INVALID_GST_DATA", "Inter-state invoice cannot contain CGST/SGST.");
  }

  return {
    status: errors.length ? errors[0].code : "READY",
    readiness: errors.length ? "NOT_ELIGIBLE" : "READY",
    errors,
    sellerGstin,
    buyerGstin,
    sellerStateCode: sellerState,
    placeOfSupplyCode: placeOfSupply,
  };
};

const buildEInvoicePayload = ({ invoice, business, customer, readiness }) => {
  if (readiness.errors.length) {
    throw new AppError("Invoice is not ready for e-invoice payload preparation", 400);
  }

  const snapshot = invoice.gstSnapshot;
  return {
    schemaVersion: "GST_EINV_V1",
    submissionConfigured: false,
    note: "Government IRP submission is not configured. This is a validated preparation payload only.",
    seller: {
      gstin: readiness.sellerGstin,
      legalName: business.name,
      address: business.address || invoice.businessDetails?.address || "",
      stateCode: readiness.sellerStateCode,
    },
    buyer: {
      gstin: readiness.buyerGstin,
      legalName: invoice.customerDetails?.name || customer?.name || "",
      address: invoice.customerDetails?.address || customer?.billingAddress || "",
      stateCode: customer?.stateCode || customer?.placeOfSupplyCode || readiness.placeOfSupplyCode,
      placeOfSupplyCode: readiness.placeOfSupplyCode,
    },
    document: {
      invoiceId: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      currency: "INR",
    },
    items: invoice.lineItems.map((item, index) => {
      const gstLine = snapshot.lines[index] || {};
      return {
        productName: item.productName,
        hsnSac: gstLine.hsnSac || "",
        quantity: item.quantity,
        rate: item.rate,
        discount: item.discount,
        taxableValue: gstLine.taxableValue,
        gstRate: gstLine.rate,
        cgst: gstLine.cgst || 0,
        sgst: gstLine.sgst || 0,
        igst: gstLine.igst || 0,
        total: item.itemTotal,
        classification: gstLine.gstClassification || "",
      };
    }),
    totals: {
      taxableValue: snapshot.taxableValue,
      cgst: snapshot.cgst,
      sgst: snapshot.sgst,
      utgst: snapshot.utgst,
      igst: snapshot.igst,
      totalTax: snapshot.totalTax,
      grandTotal: invoice.grandTotal,
    },
  };
};

const ensureEInvoiceMetadata = async ({ businessId, invoiceId, createdBy, session }) => {
  const existing = await EInvoiceMetadata.findOne({ businessId, invoiceId }).session(session);
  if (existing) return existing;
  const created = await EInvoiceMetadata.create([{ businessId, invoiceId, createdBy, eInvoiceStatus: "READY" }], { session });
  return created[0];
};

const updateReadinessMetadata = async ({ businessId, invoiceId, readiness, createdBy, session }) => {
  const metadata = await ensureEInvoiceMetadata({ businessId, invoiceId, createdBy, session });
  if (!["GENERATED", "CANCELLED"].includes(metadata.eInvoiceStatus)) {
    metadata.eInvoiceStatus = readiness.errors.length ? "FAILED" : "READY";
  }
  metadata.lastReadinessStatus = readiness.errors.length ? readiness.errors[0].code : "READY";
  metadata.lastReadinessErrors = readiness.errors.map((error) => error.code);
  await metadata.save({ session });
  return metadata;
};

const assertTransition = (from, to) => {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new AppError(`Invalid e-invoice transition from ${from} to ${to}`, 400);
  }
};

module.exports = {
  assessInvoiceReadiness,
  assertTransition,
  buildEInvoicePayload,
  getInvoiceBundle,
  updateReadinessMetadata,
};
