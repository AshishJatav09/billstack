const Business = require("../models/Business");
const BusinessSubscription = require("../models/BusinessSubscription");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const { serializeBusinessWithPlan } = require("../utils/businessPlan");
const { ensureBusinessSubscription } = require("../utils/subscription");

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
  business.billingEmail = req.body.billingEmail?.trim().toLowerCase() || "";
  business.email = req.body.email?.trim().toLowerCase() || business.billingEmail;
  business.phone = req.body.phone?.trim() || "";
  business.address = req.body.address?.trim() || "";
  business.gstTaxId = req.body.gstTaxId?.trim().toUpperCase() || "";
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

  business.planCode = req.body.planCode;
  await business.save();

  let subscription = await BusinessSubscription.findOne({ businessId: business._id });

  if (!subscription) {
    subscription = await ensureBusinessSubscription({
      businessId: business._id,
      planCode: business.planCode,
    });
  } else if (business.planCode === "free") {
    subscription.planCode = "free";
    subscription.status = "active";
    subscription.pendingPlanCode = "";
    subscription.scheduleChangeAt = "";
    await subscription.save();
  }

  res.status(200).json({
    message: "Business plan updated",
    data: serializeBusinessWithPlan(business, subscription),
  });
});

module.exports = {
  getCurrentBusiness,
  updateBusinessPlan,
  updateBusinessSetup,
};
