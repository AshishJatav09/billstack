const crypto = require("crypto");
const Razorpay = require("razorpay");

let razorpayInstance = null;

const getRazorpayInstance = () => {
  if (razorpayInstance) {
    return razorpayInstance;
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }

  razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  return razorpayInstance;
};

const getRazorpayPlanIdForCode = (planCode) => {
  const planMap = {
    basic: process.env.RAZORPAY_PLAN_BASIC_ID,
    pro: process.env.RAZORPAY_PLAN_PRO_ID,
    enterprise: process.env.RAZORPAY_PLAN_ENTERPRISE_ID,
  };

  return planMap[planCode] || "";
};

const createRazorpaySubscription = async ({
  planCode,
  totalCount = 12,
  quantity = 1,
  customerNotify = true,
  notes = {},
}) => {
  const razorpay = getRazorpayInstance();

  if (!razorpay) {
    throw new Error("Razorpay is not configured");
  }

  const planId = getRazorpayPlanIdForCode(planCode);

  if (!planId) {
    throw new Error(`No Razorpay plan is configured for ${planCode}`);
  }

  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    total_count: totalCount,
    quantity,
    customer_notify: customerNotify,
    notes,
  });

  return subscription;
};

const updateRazorpaySubscription = async ({
  subscriptionId,
  planCode,
  quantity = 1,
  remainingCount,
  scheduleChangeAt = "now",
  customerNotify = true,
}) => {
  const razorpay = getRazorpayInstance();

  if (!razorpay) {
    throw new Error("Razorpay is not configured");
  }

  const planId = getRazorpayPlanIdForCode(planCode);

  if (!planId) {
    throw new Error(`No Razorpay plan is configured for ${planCode}`);
  }

  return razorpay.subscriptions.update(subscriptionId, {
    plan_id: planId,
    quantity,
    remaining_count: remainingCount,
    schedule_change_at: scheduleChangeAt,
    customer_notify: customerNotify,
  });
};

const fetchRazorpaySubscription = async (subscriptionId) => {
  const razorpay = getRazorpayInstance();

  if (!razorpay) {
    throw new Error("Razorpay is not configured");
  }

  return razorpay.subscriptions.fetch(subscriptionId);
};

const verifyRazorpaySubscriptionPayment = ({
  razorpayPaymentId,
  razorpaySubscriptionId,
  razorpaySignature,
}) => {
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayPaymentId}|${razorpaySubscriptionId}`)
    .digest("hex");

  return generatedSignature === razorpaySignature;
};

const verifyRazorpayWebhookSignature = ({ rawBody, signature }) => {
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  return expectedSignature === signature;
};

module.exports = {
  createRazorpaySubscription,
  fetchRazorpaySubscription,
  getRazorpayInstance,
  getRazorpayPlanIdForCode,
  updateRazorpaySubscription,
  verifyRazorpaySubscriptionPayment,
  verifyRazorpayWebhookSignature,
};

