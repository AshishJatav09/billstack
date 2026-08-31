const mongoose = require("mongoose");

const EInvoiceMetadata = require("../models/EInvoiceMetadata");
const asyncHandler = require("../utils/asyncHandler");
const {
  assessInvoiceReadiness,
  buildEInvoicePayload,
  getInvoiceBundle,
  updateReadinessMetadata,
} = require("../services/einvoice.service");

const serializeMetadata = (metadata) => {
  if (!metadata) {
    return {
      eInvoiceStatus: "NOT_REQUIRED",
      cancellationStatus: "NONE",
      irn: "",
      acknowledgementNumber: "",
      acknowledgementDate: null,
      signedQrData: "",
      signedInvoiceReference: "",
      lastReadinessStatus: "",
      lastReadinessErrors: [],
    };
  }

  return {
    id: metadata._id,
    invoiceId: metadata.invoiceId,
    eInvoiceStatus: metadata.eInvoiceStatus,
    cancellationStatus: metadata.cancellationStatus,
    cancellationTimestamp: metadata.cancellationTimestamp,
    cancellationReason: metadata.cancellationReason,
    irn: metadata.irn,
    acknowledgementNumber: metadata.acknowledgementNumber,
    acknowledgementDate: metadata.acknowledgementDate,
    signedQrData: metadata.signedQrData,
    signedInvoiceReference: metadata.signedInvoiceReference,
    externalReference: metadata.externalReference,
    lastReadinessStatus: metadata.lastReadinessStatus,
    lastReadinessErrors: metadata.lastReadinessErrors,
    payloadVersion: metadata.payloadVersion,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  };
};

const checkInvoiceReadiness = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let payload;
    await session.withTransaction(async () => {
      const { invoice, business, customer } = await getInvoiceBundle({
        businessId: req.tenant.businessId,
        invoiceId: req.params.invoiceId,
        session,
      });
      const readiness = assessInvoiceReadiness({ invoice, business, customer });
      const metadata = await updateReadinessMetadata({
        businessId: req.tenant.businessId,
        invoiceId: invoice._id,
        readiness,
        createdBy: req.user._id,
        session,
      });
      payload = { readiness, metadata: serializeMetadata(metadata) };
    });
    res.status(200).json({ message: "E-invoice readiness checked", data: payload });
  } finally {
    session.endSession();
  }
});

const getEInvoiceDetails = asyncHandler(async (req, res) => {
  await getInvoiceBundle({
    businessId: req.tenant.businessId,
    invoiceId: req.params.invoiceId,
  });
  const metadata = await EInvoiceMetadata.findOne({
    businessId: req.tenant.businessId,
    invoiceId: req.params.invoiceId,
  });
  res.status(200).json({ message: "E-invoice details fetched", data: serializeMetadata(metadata) });
});

const prepareEInvoicePayload = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let responsePayload;
    await session.withTransaction(async () => {
      const { invoice, business, customer } = await getInvoiceBundle({
        businessId: req.tenant.businessId,
        invoiceId: req.params.invoiceId,
        session,
      });
      const readiness = assessInvoiceReadiness({ invoice, business, customer });
      const metadata = await updateReadinessMetadata({
        businessId: req.tenant.businessId,
        invoiceId: invoice._id,
        readiness,
        createdBy: req.user._id,
        session,
      });
      const payload = buildEInvoicePayload({ invoice, business, customer, readiness });
      responsePayload = { readiness, metadata: serializeMetadata(metadata), payload };
    });
    res.status(200).json({
      message: "E-invoice payload prepared. Government submission is not configured.",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

module.exports = {
  checkInvoiceReadiness,
  getEInvoiceDetails,
  prepareEInvoicePayload,
};
