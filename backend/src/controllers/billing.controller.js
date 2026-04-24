const Business = require("../models/Business");
const BusinessSubscription = require("../models/BusinessSubscription");
const WebhookEvent = require("../models/WebhookEvent");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");
const { getPlanByCode } = require("../utils/businessPlan");
const { serializeBusinessWithPlan } = require("../utils/businessPlan");
const {
  createRazorpaySubscription,
  fetchRazorpaySubscription,
  getRazorpayPlanIdForCode,
  updateRazorpaySubscription,
  verifyRazorpaySubscriptionPayment,
  verifyRazorpayWebhookSignature,
} = require("../services/razorpay.service");
const { ensureBusinessSubscription } = require("../utils/subscription");

const syncBusinessWithSubscription = async ({
  business,
  subscription,
  source,
}) => {
  if (subscription.planCode) {
    business.planCode = subscription.planCode;
  }

  business.subscriptionExpiresAt = subscription.currentEnd || null;
  await business.save();

  return serializeBusinessWithPlan(business, subscription, source);
};

const mapRazorpayPayloadToSubscription = (target, razorpaySubscription, planCodeOverride) => {
  target.razorpayPlanId = razorpaySubscription.plan_id || target.razorpayPlanId;
  target.razorpaySubscriptionId = razorpaySubscription.id || target.razorpaySubscriptionId;
  target.razorpayCustomerId = razorpaySubscription.customer_id || target.razorpayCustomerId;
  target.status = razorpaySubscription.status || target.status;
  target.quantity = razorpaySubscription.quantity || target.quantity;
  target.totalCount = razorpaySubscription.total_count || target.totalCount;
  target.paidCount = razorpaySubscription.paid_count || target.paidCount;
  target.currentStart = razorpaySubscription.current_start
    ? new Date(razorpaySubscription.current_start * 1000)
    : target.currentStart;
  target.currentEnd = razorpaySubscription.current_end
    ? new Date(razorpaySubscription.current_end * 1000)
    : target.currentEnd;
  target.expireBy = razorpaySubscription.expire_by
    ? new Date(razorpaySubscription.expire_by * 1000)
    : target.expireBy;
  target.shortUrl = razorpaySubscription.short_url || target.shortUrl;
  target.scheduleChangeAt = razorpaySubscription.schedule_change_at || target.scheduleChangeAt || "";
  target.planCode = planCodeOverride || target.pendingPlanCode || target.planCode;
  if (target.status === "active") {
    target.pendingPlanCode = "";
    target.scheduleChangeAt = "";
  }
};

const getCurrentSubscription = asyncHandler(async (req, res) => {
  const business = await Business.findById(req.tenant.businessId);

  if (!business) {
    throw new AppError("Business not found", 404);
  }

  const subscription = await ensureBusinessSubscription({
    businessId: business._id,
    planCode: business.planCode,
  });

  res.status(200).json({
    message: "Subscription fetched successfully",
    data: serializeBusinessWithPlan(business, subscription),
  });
});

const createSubscription = asyncHandler(async (req, res) => {
  const { planCode } = req.body;
  const business = await Business.findById(req.tenant.businessId);

  if (!business) {
    throw new AppError("Business not found", 404);
  }

  if (!["basic", "pro", "enterprise"].includes(planCode)) {
    throw new AppError("A paid plan is required for subscription creation", 400);
  }

  const subscription = await ensureBusinessSubscription({
    businessId: business._id,
    planCode: business.planCode,
  });

  const razorpaySubscription = await createRazorpaySubscription({
    planCode,
    totalCount: Number(req.body.totalCount || 12),
    quantity: Number(req.body.quantity || 1),
    notes: {
      businessId: business._id.toString(),
      businessName: business.name,
      targetPlanCode: planCode,
    },
  });

  subscription.pendingPlanCode = planCode;
  mapRazorpayPayloadToSubscription(subscription, razorpaySubscription, planCode);
  await subscription.save();

  res.status(201).json({
    message: "Subscription created successfully",
    data: {
      subscriptionId: subscription.razorpaySubscriptionId,
      shortUrl: subscription.shortUrl,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      planCode,
      business: serializeBusinessWithPlan(business, subscription),
    },
  });
});

const verifySubscriptionPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_payment_id: razorpayPaymentId,
    razorpay_subscription_id: razorpaySubscriptionId,
    razorpay_signature: razorpaySignature,
  } = req.body;

  const isValid = verifyRazorpaySubscriptionPayment({
    razorpayPaymentId: razorpayPaymentId,
    razorpaySubscriptionId: razorpaySubscriptionId,
    razorpaySignature,
  });

  if (!isValid) {
    throw new AppError("Invalid Razorpay subscription payment signature", 400);
  }

  const business = await Business.findById(req.tenant.businessId);
  const subscription = await BusinessSubscription.findOne({
    businessId: req.tenant.businessId,
    razorpaySubscriptionId: razorpaySubscriptionId,
  });

  if (!business || !subscription) {
    throw new AppError("Subscription record not found", 404);
  }

  const razorpaySubscription = await fetchRazorpaySubscription(razorpaySubscriptionId);
  subscription.lastPaymentId = razorpayPaymentId;
  subscription.verifiedAt = new Date();
  mapRazorpayPayloadToSubscription(subscription, razorpaySubscription);
  await subscription.save();

  const businessPayload = await syncBusinessWithSubscription({
    business,
    subscription,
  });

  res.status(200).json({
    message: "Subscription payment verified successfully",
    data: businessPayload,
  });
});

const changeSubscriptionPlan = asyncHandler(async (req, res) => {
  const { planCode, scheduleChangeAt = "now" } = req.body;
  const business = await Business.findById(req.tenant.businessId);
  const subscription = await ensureBusinessSubscription({
    businessId: req.tenant.businessId,
    planCode: business?.planCode || "free",
  });

  if (!business) {
    throw new AppError("Business not found", 404);
  }

  if (planCode === "free") {
    subscription.planCode = "free";
    subscription.status = "active";
    subscription.pendingPlanCode = "";
    subscription.scheduleChangeAt = "";
    subscription.cancelledAt = new Date();
    await subscription.save();
    const businessPayload = await syncBusinessWithSubscription({ business, subscription });

    res.status(200).json({
      message: "Business downgraded to Free plan",
      data: businessPayload,
    });
    return;
  }

  if (!subscription.razorpaySubscriptionId) {
    throw new AppError("No Razorpay subscription exists for this business. Create one first.", 400);
  }

  const plan = getPlanByCode(planCode);
  if (!getRazorpayPlanIdForCode(planCode) || !plan) {
    throw new AppError("Selected plan is not configured for Razorpay", 400);
  }

  const razorpaySubscription = await updateRazorpaySubscription({
    subscriptionId: subscription.razorpaySubscriptionId,
    planCode,
    quantity: subscription.quantity,
    remainingCount: subscription.totalCount - subscription.paidCount,
    scheduleChangeAt,
  });

  subscription.pendingPlanCode = planCode;
  subscription.scheduleChangeAt = scheduleChangeAt;
  mapRazorpayPayloadToSubscription(subscription, razorpaySubscription);
  await subscription.save();

  res.status(200).json({
    message: `${scheduleChangeAt === "cycle_end" ? "Downgrade" : "Upgrade"} scheduled successfully`,
    data: serializeBusinessWithPlan(business, subscription),
  });
});

const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const eventId = req.headers["x-razorpay-event-id"];
  const rawBody = req.body.toString();

  if (!verifyRazorpayWebhookSignature({ rawBody, signature })) {
    throw new AppError("Invalid Razorpay webhook signature", 400);
  }

  const duplicate = await WebhookEvent.findOne({ eventId });
  if (duplicate) {
    res.status(200).json({ message: "Duplicate webhook ignored" });
    return;
  }

  const payload = JSON.parse(rawBody);
  const subscriptionEntity = payload.payload?.subscription?.entity;

  if (subscriptionEntity?.id) {
    const subscription = await BusinessSubscription.findOne({
      razorpaySubscriptionId: subscriptionEntity.id,
    });

    if (subscription) {
      const business = await Business.findById(subscription.businessId);
      mapRazorpayPayloadToSubscription(subscription, subscriptionEntity);

      if (subscription.pendingPlanCode && ["active", "authenticated"].includes(subscription.status)) {
        subscription.planCode = subscription.pendingPlanCode;
        subscription.pendingPlanCode = "";
        subscription.scheduleChangeAt = "";
      }

      if (["cancelled", "expired", "completed"].includes(subscription.status) && subscription.planCode !== "free") {
        business.planCode = "free";
      } else {
        business.planCode = subscription.planCode;
      }

      business.subscriptionExpiresAt = subscription.currentEnd || null;
      await Promise.all([subscription.save(), business.save()]);
    }
  }

  await WebhookEvent.create({
    eventId,
    eventType: payload.event,
    payload,
  });

  res.status(200).json({
    message: "Webhook processed successfully",
  });
});

module.exports = {
  changeSubscriptionPlan,
  createSubscription,
  getCurrentSubscription,
  handleRazorpayWebhook,
  verifySubscriptionPayment,
};

