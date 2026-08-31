const crypto = require("crypto");
const CommercialModule = require("../models/CommercialModule");
const ModuleOffer = require("../models/ModuleOffer");
const ModuleOrder = require("../models/ModuleOrder");
const ModuleRequest = require("../models/ModuleRequest");
const BusinessModuleConfig = require("../models/BusinessModuleConfig");
const AppError = require("../utils/appError");
const { writeAuditLog } = require("./audit.service");
const { createRazorpayOrder, verifyRazorpayOrderPayment } = require("./razorpay.service");
const { MODULE_STATES, moduleCatalog } = require("../constants/modules");

const money = (value) => Math.round(Number(value || 0) * 100) / 100;
const minorUnits = (value) => Math.round(money(value) * 100);

const commercialDefaults = {
  communications: { commercialType: "PAID_ADDON", pricingType: "MONTHLY", defaultPrice: 4999, badgeText: "Popular add-on" },
  advanced_reports: { commercialType: "PAID_ADDON", pricingType: "MONTHLY", defaultPrice: 2499 },
  expenses: { commercialType: "INCLUDED", pricingType: "ONE_TIME", defaultPrice: 0 },
  documents: { commercialType: "PAID_ADDON", pricingType: "MONTHLY", defaultPrice: 999 },
  projects: { commercialType: "CONTACT_SALES", pricingType: "CUSTOM", defaultPrice: 0 },
  scheduling: { commercialType: "PAID_ADDON", pricingType: "MONTHLY", defaultPrice: 1999 },
  renewals: { commercialType: "PAID_ADDON", pricingType: "MONTHLY", defaultPrice: 999 },
};

const validateCommercialPayload = (payload) => {
  const price = Number(payload.defaultPrice ?? 0);
  const gstRate = Number(payload.gstRate ?? 0);
  if (price < 0 || !Number.isFinite(price)) throw new AppError("Price cannot be negative", 400);
  if (gstRate < 0 || gstRate > 28 || !Number.isFinite(gstRate)) throw new AppError("Invalid GST rate", 400);
  if (payload.currency && payload.currency !== "INR") throw new AppError("Only INR is supported", 400);
  if (payload.pricingType === "FREE" && price > 0) throw new AppError("Free pricing cannot have a payable amount", 400);
  if (["CUSTOM"].includes(payload.pricingType) && price > 0) throw new AppError("Custom pricing should be negotiated through an offer", 400);
};

const syncCommercialCatalogue = async () => {
  const results = [];
  for (const technical of moduleCatalog) {
    const defaults = commercialDefaults[technical.key] || {};
    const commercialType = defaults.commercialType || (technical.isAddOn ? "CONTACT_SALES" : "PLAN_INCLUDED");
    const pricingType = defaults.pricingType || (commercialType === "PAID_ADDON" ? "MONTHLY" : "FREE");
    const doc = await CommercialModule.findOneAndUpdate(
      { moduleKey: technical.key },
      {
        $setOnInsert: {
          displayName: technical.name,
          shortDescription: technical.description,
          longDescription: technical.description,
          category: technical.category,
          commercialType,
          pricingType,
          defaultPrice: defaults.defaultPrice || 0,
          currency: "INR",
          gstApplicable: commercialType === "PAID_ADDON",
          gstRate: commercialType === "PAID_ADDON" ? 18 : 0,
          negotiable: commercialType !== "PLAN_INCLUDED",
          availableForSaas: technical.availableForSaas,
          availableForSelfHosted: technical.availableForSelfHosted,
          active: true,
          displayOrder: results.length + 1,
          badgeText: defaults.badgeText || "",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    results.push(doc);
  }
  return results;
};

const listCommercialCatalogue = async () => {
  await syncCommercialCatalogue();
  return CommercialModule.find({}).sort({ displayOrder: 1, displayName: 1 });
};

const updateCommercialModule = async ({ moduleKey, payload, req }) => {
  validateCommercialPayload(payload);
  const doc = await CommercialModule.findOneAndUpdate(
    { moduleKey: String(moduleKey).toLowerCase() },
    { $set: payload },
    { new: true, runValidators: true }
  );
  if (!doc) throw new AppError("Commercial module not found", 404);
  if (req) await writeAuditLog({ req, action: "COMMERCIAL_MODULE_UPDATED", entityType: "COMMERCIAL_MODULE", entityId: doc._id, metadata: { moduleKey, payload } });
  return doc;
};

const calculateOfferTotals = ({ price, gstApplicable, gstRate }) => {
  const subtotal = money(price);
  const taxAmount = gstApplicable ? money((subtotal * Number(gstRate || 0)) / 100) : 0;
  return { subtotal, taxAmount, finalAmount: money(subtotal + taxAmount) };
};

const createOffer = async ({ businessId, moduleKey, moduleRequestId, negotiatedPrice, adminNote, validUntil, offeredBy, req }) => {
  const commercial = await CommercialModule.findOne({ moduleKey, active: true });
  if (!commercial) throw new AppError("Commercial module not found", 404);
  if (moduleRequestId) {
    const existingOffer = await ModuleOffer.findOne({
      businessId,
      moduleKey,
      moduleRequestId,
      status: { $in: ["OFFERED", "PAYMENT_PENDING", "ACCEPTED", "PAID", "ACTIVATED"] },
    }).sort({ createdAt: -1 });
    if (existingOffer) return existingOffer;
  }
  if (["FREE", "PLAN_INCLUDED"].includes(commercial.commercialType)) {
    negotiatedPrice = 0;
  }
  if (commercial.commercialType === "CONTACT_SALES" && negotiatedPrice === undefined) {
    negotiatedPrice = 0;
  }
  const standardPrice = money(commercial.defaultPrice);
  const finalBasePrice = money(negotiatedPrice ?? standardPrice);
  if (finalBasePrice < 0) throw new AppError("Negotiated price cannot be negative", 400);
  if (["FREE", "CUSTOM"].includes(commercial.pricingType) && finalBasePrice > 0) {
    throw new AppError("This module requires a custom commercial process", 400);
  }
  const totals = calculateOfferTotals({ price: finalBasePrice, gstApplicable: commercial.gstApplicable, gstRate: commercial.gstRate });
  const sourceKey = crypto
    .createHash("sha256")
    .update(`${businessId}:${moduleKey}:${moduleRequestId || "direct"}:${Date.now()}:${finalBasePrice}`)
    .digest("hex");
  const offer = await ModuleOffer.create({
    businessId,
    moduleKey,
    moduleRequestId,
    standardPrice,
    negotiatedPrice: finalBasePrice,
    discountAmount: money(Math.max(0, standardPrice - finalBasePrice)),
    gstRate: commercial.gstApplicable ? commercial.gstRate : 0,
    ...totals,
    currency: "INR",
    pricingType: commercial.pricingType,
    commercialType: commercial.commercialType,
    status: "OFFERED",
    adminNote,
    offeredBy,
    validUntil,
    sourceKey,
  });
  if (moduleRequestId) {
    await ModuleRequest.findByIdAndUpdate(moduleRequestId, { status: "UNDER_REVIEW", adminNote: adminNote || "" });
  }
  if (req) await writeAuditLog({ req, action: "MODULE_OFFER_CREATED", entityType: "MODULE_OFFER", entityId: offer._id, metadata: { moduleKey, businessId, standardPrice, negotiatedPrice: finalBasePrice } });
  return offer;
};

const acceptOffer = async ({ businessId, offerId, userId, customerNote }) => {
  const offer = await ModuleOffer.findOne({ _id: offerId, businessId });
  if (!offer) throw new AppError("Offer not found", 404);
  if (offer.status !== "OFFERED") throw new AppError("Offer is not open for acceptance", 400);
  if (offer.validUntil && offer.validUntil < new Date()) {
    offer.status = "EXPIRED";
    await offer.save();
    throw new AppError("Offer has expired", 400);
  }
  offer.status = offer.finalAmount > 0 ? "PAYMENT_PENDING" : "ACCEPTED";
  offer.acceptedBy = userId;
  offer.acceptedAt = new Date();
  offer.customerNote = customerNote || "";
  await offer.save();
  if (offer.finalAmount === 0) await activatePurchasedModule({ offerId: offer._id, source: "FREE_OR_INCLUDED" });
  return offer;
};

const declineOffer = async ({ businessId, offerId, userId, note }) => {
  const offer = await ModuleOffer.findOne({ _id: offerId, businessId });
  if (!offer) throw new AppError("Offer not found", 404);
  if (!["OFFERED", "PAYMENT_PENDING"].includes(offer.status)) throw new AppError("Offer cannot be declined", 400);
  offer.status = "REJECTED";
  offer.acceptedBy = userId || offer.acceptedBy;
  offer.customerNote = note || offer.customerNote;
  await offer.save();
  return offer;
};

const createRazorpayAddonOrder = async ({ businessId, offerId }) => {
  const offer = await ModuleOffer.findOne({ _id: offerId, businessId });
  if (!offer) throw new AppError("Offer not found", 404);
  if (offer.status !== "PAYMENT_PENDING") throw new AppError("Offer must be accepted before payment", 400);
  if (offer.finalAmount <= 0) throw new AppError("This offer does not require Razorpay payment", 400);
  let order = await ModuleOrder.findOne({ businessId, offerId, paymentMethod: "RAZORPAY" });
  if (order?.providerOrderId) return order;
  let providerOrder;
  try {
    providerOrder = await createRazorpayOrder({
      amount: minorUnits(offer.finalAmount),
      currency: "INR",
      receipt: `addon_${offer._id.toString().slice(-12)}`,
      notes: { businessId: businessId.toString(), offerId: offer._id.toString(), moduleKey: offer.moduleKey },
    });
  } catch (_error) {
    throw new AppError("Razorpay is not configured", 503);
  }
  if (!order) {
    order = await ModuleOrder.create({
      businessId,
      offerId,
      moduleKey: offer.moduleKey,
      amount: offer.subtotal,
      taxAmount: offer.taxAmount,
      totalAmount: offer.finalAmount,
      currency: "INR",
      paymentMethod: "RAZORPAY",
      paymentStatus: "PENDING",
      providerOrderId: providerOrder.id,
      idempotencyKey: `razorpay:${offer._id}`,
    });
  } else {
    order.providerOrderId = providerOrder.id;
    await order.save();
  }
  return order;
};

const verifyRazorpayAddonPayment = async ({ businessId, providerOrderId, providerPaymentId, signature }) => {
  let validSignature = false;
  try {
    validSignature = verifyRazorpayOrderPayment({ razorpayOrderId: providerOrderId, razorpayPaymentId: providerPaymentId, razorpaySignature: signature });
  } catch (_error) {
    throw new AppError("Razorpay is not configured", 503);
  }
  if (!validSignature) {
    throw new AppError("Invalid Razorpay payment signature", 400);
  }
  const order = await ModuleOrder.findOne({ businessId, providerOrderId, paymentMethod: "RAZORPAY" });
  if (!order) throw new AppError("Commercial order not found", 404);
  if (order.paymentStatus === "PAID") return order;
  order.paymentStatus = "PAID";
  order.providerPaymentId = providerPaymentId;
  order.paidAt = new Date();
  await order.save();
  await ModuleOffer.findByIdAndUpdate(order.offerId, { status: "PAID" });
  await activatePurchasedModule({ orderId: order._id, source: "RAZORPAY" });
  return order;
};

const createManualUpiOrder = async ({ businessId, offerId, utrReference, manualPaymentDate, customerNote }) => {
  const offer = await ModuleOffer.findOne({ _id: offerId, businessId });
  if (!offer) throw new AppError("Offer not found", 404);
  if (offer.status !== "PAYMENT_PENDING") throw new AppError("Offer must be accepted before payment", 400);
  const utr = String(utrReference || "").trim().toUpperCase();
  if (!utr) throw new AppError("UTR / transaction reference is required", 400);
  return ModuleOrder.create({
    businessId,
    offerId,
    moduleKey: offer.moduleKey,
    amount: offer.subtotal,
    taxAmount: offer.taxAmount,
    totalAmount: offer.finalAmount,
    currency: "INR",
    paymentMethod: "MANUAL_UPI",
    paymentStatus: "AWAITING_VERIFICATION",
    utrReference: utr,
    manualPaymentDate: manualPaymentDate ? new Date(manualPaymentDate) : null,
    customerNote: customerNote || "",
    idempotencyKey: `manual_upi:${offer._id}:${utr}`,
  });
};

const verifyManualOrder = async ({ orderId, status, adminNote, req }) => {
  const order = await ModuleOrder.findById(orderId);
  if (!order) throw new AppError("Commercial order not found", 404);
  if (order.paymentMethod !== "MANUAL_UPI" && order.paymentMethod !== "ADMIN_MARKED") throw new AppError("Order is not a manual verification order", 400);
  if (order.paymentStatus !== "AWAITING_VERIFICATION" && order.paymentStatus !== "PENDING") return order;
  if (status === "PAID") {
    order.paymentStatus = "PAID";
    order.paidAt = new Date();
    order.adminNote = adminNote || "";
    await order.save();
    await ModuleOffer.findByIdAndUpdate(order.offerId, { status: "PAID" });
    await activatePurchasedModule({ orderId: order._id, source: order.paymentMethod });
  } else if (status === "REJECTED") {
    order.paymentStatus = "REJECTED";
    order.adminNote = adminNote || "";
    await order.save();
  } else {
    throw new AppError("Invalid manual payment decision", 400);
  }
  if (req) await writeAuditLog({ req, action: "COMMERCIAL_MANUAL_PAYMENT_REVIEWED", entityType: "MODULE_ORDER", entityId: order._id, metadata: { status, moduleKey: order.moduleKey } });
  return order;
};

async function activatePurchasedModule({ orderId = null, offerId = null, source = "SYSTEM" }) {
  const order = orderId ? await ModuleOrder.findById(orderId) : null;
  const offer = order ? await ModuleOffer.findById(order.offerId) : await ModuleOffer.findById(offerId);
  if (!offer) throw new AppError("Offer not found", 404);
  if (order && order.paymentStatus !== "PAID") throw new AppError("Payment must be verified before activation", 400);
  if (offer.finalAmount > 0 && !order) throw new AppError("Paid offer requires a verified order", 400);
  if (order?.activationStatus === "ACTIVATED" || offer.status === "ACTIVATED") return { order, offer };
  await BusinessModuleConfig.findOneAndUpdate(
    { businessId: offer.businessId, moduleKey: offer.moduleKey },
    { $set: { state: MODULE_STATES.ACTIVE, source: `COMMERCIAL_${source}` } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  offer.status = "ACTIVATED";
  await offer.save();
  if (order) {
    order.activationStatus = "ACTIVATED";
    order.activatedAt = new Date();
    await order.save();
  }
  return { order, offer };
}

module.exports = {
  acceptOffer,
  activatePurchasedModule,
  createManualUpiOrder,
  createOffer,
  createRazorpayAddonOrder,
  declineOffer,
  listCommercialCatalogue,
  syncCommercialCatalogue,
  updateCommercialModule,
  verifyManualOrder,
  verifyRazorpayAddonPayment,
};
