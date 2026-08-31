const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const CommercialModule = require("../src/models/CommercialModule");
const ModuleOffer = require("../src/models/ModuleOffer");
const ModuleOrder = require("../src/models/ModuleOrder");
const { coreModuleKeys, moduleCatalog } = require("../src/constants/modules");
const { verifyRazorpayOrderPayment } = require("../src/services/razorpay.service");

test("commercial catalogue keeps products/services as protected core, not inventory add-on", () => {
  const productMaster = moduleCatalog.find((module) => module.key === "products_services");
  const inventory = moduleCatalog.find((module) => module.key === "inventory");

  assert.equal(productMaster.status, "IMPLEMENTED");
  assert.equal(productMaster.defaultEnabled, true);
  assert.equal(coreModuleKeys.includes("products_services"), true);
  assert.equal(inventory.status, "IMPLEMENTED");
  assert.equal(inventory.dependencies.includes("products_services"), true);
  assert.equal(coreModuleKeys.includes("inventory"), false);
});

test("commercial module validates server-owned INR pricing and GST bounds", async () => {
  const module = new CommercialModule({
    moduleKey: "communications",
    displayName: "Communications",
    commercialType: "PAID_ADDON",
    pricingType: "MONTHLY",
    defaultPrice: 4999,
    currency: "INR",
    gstApplicable: true,
    gstRate: 18,
  });

  await assert.doesNotReject(() => module.validate());

  module.gstRate = 32;
  await assert.rejects(() => module.validate(), /maximum allowed value/);
});

test("module offers persist negotiated server-side price snapshots", async () => {
  const offer = new ModuleOffer({
    businessId: "64f000000000000000000001",
    moduleKey: "communications",
    standardPrice: 4999,
    negotiatedPrice: 3999,
    discountAmount: 1000,
    gstRate: 18,
    taxAmount: 719.82,
    subtotal: 3999,
    finalAmount: 4718.82,
    pricingType: "MONTHLY",
    commercialType: "PAID_ADDON",
    status: "OFFERED",
    sourceKey: "tenant:communications:request:3999",
  });

  await assert.doesNotReject(() => offer.validate());
  assert.equal(offer.finalAmount, 4718.82);
  assert.equal(offer.status, "OFFERED");
});

test("manual UPI orders remain pending verification and use idempotency fields", async () => {
  const order = new ModuleOrder({
    businessId: "64f000000000000000000001",
    offerId: "64f000000000000000000002",
    moduleKey: "communications",
    amount: 3999,
    taxAmount: 719.82,
    totalAmount: 4718.82,
    paymentMethod: "MANUAL_UPI",
    paymentStatus: "AWAITING_VERIFICATION",
    activationStatus: "PENDING",
    utrReference: "UTR123456789",
    idempotencyKey: "manual_upi:offer:UTR123456789",
  });

  await assert.doesNotReject(() => order.validate());
  assert.equal(order.paymentStatus, "AWAITING_VERIFICATION");
  assert.equal(order.activationStatus, "PENDING");
});

test("module order schema has duplicate protection for offer payments and UTR references", () => {
  const indexes = ModuleOrder.schema.indexes().map(([fields, options]) => ({ fields, options }));

  assert.ok(indexes.some((index) => index.fields.businessId === 1 && index.fields.offerId === 1 && index.fields.paymentMethod === 1 && index.options.unique));
  assert.ok(indexes.some((index) => index.fields.idempotencyKey === 1 && index.options.unique));
  assert.ok(indexes.some((index) => index.fields.utrReference === 1 && index.options.unique));
});

test("Razorpay add-on order signature verification is real and fails invalid signatures", () => {
  const previousSecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_SECRET = "test_razorpay_secret";

  const orderId = "order_TEST123";
  const paymentId = "pay_TEST123";
  const validSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  assert.equal(
    verifyRazorpayOrderPayment({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: validSignature,
    }),
    true
  );
  assert.equal(
    verifyRazorpayOrderPayment({
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: "bad_signature",
    }),
    false
  );

  if (previousSecret === undefined) {
    delete process.env.RAZORPAY_KEY_SECRET;
  } else {
    process.env.RAZORPAY_KEY_SECRET = previousSecret;
  }
});
