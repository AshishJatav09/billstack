const asyncHandler = require("../utils/asyncHandler");
const {
  acceptOffer,
  createManualUpiOrder,
  createRazorpayAddonOrder,
  declineOffer,
  verifyRazorpayAddonPayment,
} = require("../services/commercial.service");
const ModuleOffer = require("../models/ModuleOffer");
const ModuleOrder = require("../models/ModuleOrder");

const {
  createModuleRequest,
  getBusinessModules,
  getPresetRecommendations,
  resolveWorkspacePreset,
  setBusinessModuleState,
  updateBusinessProfile,
} = require("../services/module.service");
const { capabilityCatalog, industryCatalog } = require("../constants/industry-presets");
const { serializeBusinessWithPlan } = require("../utils/businessPlan");
const { ensureBusinessSubscription } = require("../utils/subscription");
const { writeAuditLog } = require("../services/audit.service");

const getModules = asyncHandler(async (req, res) => {
  const data = await getBusinessModules({ businessId: req.tenant.businessId });
  res.status(200).json({ message: "Modules fetched successfully", data });
});

const getPreset = asyncHandler(async (req, res) => {
  const data = getPresetRecommendations(req.params.preset);
  res.status(200).json({ message: "Preset fetched successfully", data });
});

const getIndustryCatalogue = asyncHandler(async (_req, res) => {
  res.status(200).json({ message: "Industry catalogue fetched successfully", data: { industries: industryCatalog, capabilities: capabilityCatalog } });
});

const getWorkspaceRecommendation = asyncHandler(async (req, res) => {
  const data = resolveWorkspacePreset(req.body || req.query || {});
  res.status(200).json({ message: "Workspace recommendation generated", data });
});

const updateModuleState = asyncHandler(async (req, res) => {
  const config = await setBusinessModuleState({
    businessId: req.tenant.businessId,
    moduleKey: req.params.moduleKey,
    state: req.body.state,
    userId: req.user._id,
    source: "SETTINGS",
  });

  await writeAuditLog({
    req,
    action: "BUSINESS_MODULE_STATE_CHANGED",
    entityType: "BUSINESS_MODULE_CONFIG",
    entityId: config._id,
    metadata: { moduleKey: config.moduleKey, state: config.state },
  });

  res.status(200).json({ message: "Module configuration updated", data: config });
});

const requestModule = asyncHandler(async (req, res) => {
  const request = await createModuleRequest({
    businessId: req.tenant.businessId,
    moduleKey: req.body.moduleKey,
    requestType: req.body.requestType,
    message: req.body.message,
    requestedBy: req.user._id,
  });

  res.status(201).json({ message: "Module request submitted", data: request });
});

const updateProfile = asyncHandler(async (req, res) => {
  const business = await updateBusinessProfile({
    businessId: req.tenant.businessId,
    payload: req.body,
  });
  const subscription = await ensureBusinessSubscription({
    businessId: business._id,
    planCode: business.planCode,
  });

  await writeAuditLog({
    req,
    action: "BUSINESS_PROFILE_UPDATED",
    entityType: "BUSINESS",
    entityId: business._id,
    metadata: { preset: business.businessProfile?.preset },
  });

  res.status(200).json({
    message: "Business profile updated",
    data: serializeBusinessWithPlan(business, subscription),
  });
});

const listOffers = asyncHandler(async (req, res) => {
  const offers = await ModuleOffer.find({ businessId: req.tenant.businessId }).sort("-createdAt");
  res.status(200).json({ message: "Offers fetched successfully", data: offers });
});

const acceptModuleOffer = asyncHandler(async (req, res) => {
  const offer = await acceptOffer({
    businessId: req.tenant.businessId,
    offerId: req.params.offerId,
    userId: req.user._id,
    customerNote: req.body.customerNote,
  });
  res.status(200).json({ message: "Offer accepted", data: offer });
});

const declineModuleOffer = asyncHandler(async (req, res) => {
  const offer = await declineOffer({
    businessId: req.tenant.businessId,
    offerId: req.params.offerId,
    userId: req.user._id,
    note: req.body.note,
  });
  res.status(200).json({ message: "Offer declined", data: offer });
});

const createRazorpayOrder = asyncHandler(async (req, res) => {
  const order = await createRazorpayAddonOrder({
    businessId: req.tenant.businessId,
    offerId: req.params.offerId,
  });
  res.status(201).json({
    message: "Razorpay add-on order created",
    data: {
      orderId: order._id,
      razorpayOrderId: order.providerOrderId,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
      amount: order.totalAmount,
      currency: order.currency,
    },
  });
});

const verifyRazorpayOrder = asyncHandler(async (req, res) => {
  const order = await verifyRazorpayAddonPayment({
    businessId: req.tenant.businessId,
    providerOrderId: req.body.razorpay_order_id,
    providerPaymentId: req.body.razorpay_payment_id,
    signature: req.body.razorpay_signature,
  });
  res.status(200).json({ message: "Add-on payment verified", data: order });
});

const submitManualUpi = asyncHandler(async (req, res) => {
  const order = await createManualUpiOrder({
    businessId: req.tenant.businessId,
    offerId: req.params.offerId,
    utrReference: req.body.utrReference,
    manualPaymentDate: req.body.paymentDate,
    customerNote: req.body.note,
  });
  res.status(201).json({ message: "Manual UPI payment submitted for verification", data: order });
});

const listOrders = asyncHandler(async (req, res) => {
  const orders = await ModuleOrder.find({ businessId: req.tenant.businessId }).sort("-createdAt");
  res.status(200).json({ message: "Commercial orders fetched successfully", data: orders });
});

module.exports = {
  acceptModuleOffer,
  createRazorpayOrder,
  declineModuleOffer,
  getModules,
  getIndustryCatalogue,
  getPreset,
  getWorkspaceRecommendation,
  listOffers,
  listOrders,
  requestModule,
  submitManualUpi,
  updateModuleState,
  updateProfile,
  verifyRazorpayOrder,
};
