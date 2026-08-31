const Business = require("../models/Business");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const { serializeBusinessWithPlan } = require("../utils/businessPlan");
const { applyControlledPlanChange, ensureBusinessSubscription } = require("../utils/subscription");
const { validateGstin, validateStateCode } = require("../utils/gst");
const { writeAuditLog } = require("../services/audit.service");
const { getPresetRecommendations } = require("../services/module.service");
const { createSampleData, removeSampleData, recommendPlanForProfile } = require("../services/commercial-plan.service");

const getCurrentBusiness = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.tenant.businessId);

  if (!business) {
    throw new AppError("Business not found", 404);
  }

  const subscription = await ensureBusinessSubscription({
    businessId: business._id,
    planCode: business.planCode,
  });

  res.status(200).json({
    message: "Business fetched successfully",
    data: serializeBusinessWithPlan(business, subscription),
  });
});

const updateBusinessSetup = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.tenant.businessId);

  if (!business) {
    throw new AppError("Business not found", 404);
  }

  business.name = req.body.name.trim();
  business.industry = req.body.industry?.trim() || "";
  const selectedNeeds = Array.isArray(req.body.selectedNeeds)
    ? req.body.selectedNeeds
    : String(req.body.selectedNeeds || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const selectedModules = Array.isArray(req.body.selectedModules)
    ? req.body.selectedModules
    : String(req.body.selectedModules || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const preset = (req.body.preset || req.body.businessModel || "CUSTOM").toString().toUpperCase();
  const recommendations = getPresetRecommendations(preset);
  business.businessProfile = {
    playerType: req.body.playerType?.trim() || business.businessProfile?.playerType || "",
    businessModel: req.body.businessModel || business.businessProfile?.businessModel || "",
    businessSize: req.body.businessSize?.trim() || business.businessProfile?.businessSize || "",
    numberOfUsers: Math.max(1, Number(req.body.numberOfUsers || business.businessProfile?.numberOfUsers || 1)),
    numberOfLocations: Math.max(1, Number(req.body.numberOfLocations || business.businessProfile?.numberOfLocations || 1)),
    gstRegistered:
      req.body.gstRegistered === true ||
      req.body.gstRegistered === "true" ||
      business.businessProfile?.gstRegistered ||
      false,
    selectedNeeds,
    recommendedModules: Array.from(new Set([...recommendations.moduleKeys, ...selectedModules])),
    preset: recommendations.preset,
    onboardingStatus: "COMPLETED",
  };
  business.billingEmail = req.body.billingEmail?.trim().toLowerCase() || "";
  business.email = req.body.email?.trim().toLowerCase() || business.billingEmail;
  business.phone = req.body.phone?.trim() || "";
  business.address = req.body.address?.trim() || "";
  business.gstTaxId = req.body.gstTaxId?.trim().toUpperCase() || "";
  const gstEnabled = req.body.gstEnabled === true || req.body.gstEnabled === "true";
  const gstin = (req.body.gstConfigurationGstin || req.body.gstTaxId || "").trim().toUpperCase();
  const stateCode = (req.body.gstStateCode || "").trim();
  if (gstEnabled) {
    if (!validateGstin(gstin)) throw new AppError("Invalid GSTIN", 400);
    if (!validateStateCode(stateCode)) throw new AppError("Invalid GST state code", 400);
  }
  business.gstConfiguration = {
    enabled: gstEnabled,
    gstin,
    stateCode,
    state: req.body.gstState?.trim() || "",
  };
  business.invoiceTerms = req.body.invoiceTerms?.trim() || "";
  business.defaultTaxSettings = {
    taxName: req.body.taxName?.trim() || "GST",
    taxRate: Number(req.body.taxRate ?? 18),
    taxMode: req.body.taxMode || "exclusive",
  };
  business.invoiceNumbering = {
    prefix: req.body.invoicePrefix?.trim() || "INV",
    format: req.body.invoiceNumberingFormat?.trim() || "INV-{YYYY}-{0001}",
    nextSequence: business.invoiceNumbering?.nextSequence || 1,
  };
  business.bankDetails = {
    accountName: req.body.bankAccountName?.trim() || "",
    bankName: req.body.bankName?.trim() || "",
    accountNumber: req.body.bankAccountNumber?.trim() || "",
    ifscCode: req.body.bankIfscCode?.trim().toUpperCase() || "",
    upiId: req.body.bankUpiId?.trim() || "",
  };
  business.inventorySettings = {
    allowNegativeStock:
      req.body.allowNegativeStock === true || req.body.allowNegativeStock === "true",
  };
  business.onboardingCompleted = true;

  if (req.file) {
    business.logoUrl = `/uploads/logos/${req.file.filename}`;
  }

  await business.save();
  await writeAuditLog({ req, action: "BUSINESS_SETTINGS_UPDATED", entityType: "BUSINESS", entityId: business._id, metadata: { gstEnabled, stateCode, changedFields: Object.keys(req.body || {}) } });

  const subscription = await ensureBusinessSubscription({
    businessId: business._id,
    planCode: business.planCode,
  });

  res.status(200).json({
    message: "Business onboarding updated",
    data: serializeBusinessWithPlan(business, subscription),
  });
});

const updateBusinessPlan = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.tenant.businessId);

  if (!business) {
    throw new AppError("Business not found", 404);
  }

  const { subscription } = await applyControlledPlanChange({
    businessId: business._id,
    planCode: req.body.planCode,
    status: req.body.planCode === "free" ? "free" : "active",
    source: "business_settings",
  });
  await business.reload?.();
  const nextBusiness = await Business.findById(business._id);
  await writeAuditLog({ req, action: "SUBSCRIPTION_PLAN_CHANGED", entityType: "BUSINESS_SUBSCRIPTION", entityId: subscription._id, metadata: { planCode: req.body.planCode, source: "business_settings" } });

  res.status(200).json({
    message: "Business plan updated",
    data: serializeBusinessWithPlan(nextBusiness, subscription),
  });
});

const getPlanRecommendation = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.tenant.businessId);
  if (!business) throw new AppError("Business not found", 404);
  res.status(200).json({
    message: "Plan recommendation fetched",
    data: recommendPlanForProfile(business.businessProfile || {}),
  });
});

const createBusinessSampleData = asyncHandler(async (req, res) => {
  const data = await createSampleData({ businessId: req.tenant.businessId, userId: req.user._id });
  await writeAuditLog({ req, action: "SAMPLE_DATA_CREATED", entityType: "BUSINESS", entityId: req.tenant.businessId, metadata: { created: data.created } });
  res.status(data.created ? 201 : 200).json({ message: data.created ? "Sample data created" : data.message, data });
});

const removeBusinessSampleData = asyncHandler(async (req, res) => {
  const data = await removeSampleData({ businessId: req.tenant.businessId });
  await writeAuditLog({ req, action: "SAMPLE_DATA_REMOVED", entityType: "BUSINESS", entityId: req.tenant.businessId, metadata: data });
  res.status(200).json({ message: "Sample data removed", data });
});

module.exports = {
  getCurrentBusiness,
  createBusinessSampleData,
  getPlanRecommendation,
  removeBusinessSampleData,
  updateBusinessPlan,
  updateBusinessSetup,
};
