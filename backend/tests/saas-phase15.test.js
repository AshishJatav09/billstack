const test = require("node:test");
const assert = require("node:assert/strict");

const User = require("../src/models/User");
const BusinessSubscription = require("../src/models/BusinessSubscription");
const { PLAN_DEFINITIONS } = require("../src/constants/plans");
const {
  getDefaultSubscriptionState,
  getPlanEntitlements,
  isSubscriptionAccessible,
  isSubscriptionExpired,
  normalizeStatus,
} = require("../src/services/subscription.service");
const { verifyGoogleIdentityToken } = require("../src/services/google-auth.service");

test("Google token verification rejects unconfigured login and validates verified tokeninfo claims", async () => {
  const oldClientId = process.env.GOOGLE_CLIENT_ID;
  const oldFetch = global.fetch;
  delete process.env.GOOGLE_CLIENT_ID;
  await assert.rejects(() => verifyGoogleIdentityToken("token"), /not configured/i);

  process.env.GOOGLE_CLIENT_ID = "client-123";
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      aud: "client-123",
      sub: "google-subject",
      email: "Owner@Example.com",
      email_verified: "true",
      name: "Owner",
    }),
  });
  const identity = await verifyGoogleIdentityToken("token");
  assert.equal(identity.email, "owner@example.com");
  assert.equal(identity.subject, "google-subject");
  assert.equal(identity.emailVerified, true);

  global.fetch = async () => ({ ok: true, json: async () => ({ aud: "other", sub: "x", email: "x@y.com", email_verified: "true" }) });
  await assert.rejects(() => verifyGoogleIdentityToken("token"), /audience/i);

  if (oldClientId) process.env.GOOGLE_CLIENT_ID = oldClientId; else delete process.env.GOOGLE_CLIENT_ID;
  global.fetch = oldFetch;
});

test("User model supports safe Google linking and duplicate-subject prevention", () => {
  const authProvider = User.schema.path("authProvider").enumValues;
  assert.ok(authProvider.includes("password"));
  assert.ok(authProvider.includes("google"));
  assert.ok(authProvider.includes("password_google"));
  const indexes = User.schema.indexes().map(([fields]) => fields);
  assert.ok(indexes.some((fields) => fields.businessId === 1 && fields.email === 1));
  assert.ok(indexes.some((fields) => fields.googleSubject === 1));
});

test("subscription lifecycle states cover SaaS free, trial, paid, grace and expired flows", () => {
  assert.equal(normalizeStatus("ACTIVE", "pro"), "active");
  assert.equal(normalizeStatus("", "free"), "free");
  assert.equal(isSubscriptionAccessible({ planCode: "free", status: "free" }), true);
  assert.equal(isSubscriptionAccessible({ planCode: "pro", status: "trial", trialEndsAt: new Date(Date.now() + 86400000) }), true);
  assert.equal(isSubscriptionAccessible({ planCode: "pro", status: "grace_period", graceEndsAt: new Date(Date.now() + 86400000) }), true);
  assert.equal(isSubscriptionAccessible({ planCode: "pro", status: "past_due" }), false);
  assert.equal(isSubscriptionExpired({ planCode: "pro", status: "expired" }), true);
});

test("plans are centrally configurable with communication, WhatsApp and GST/e-invoice entitlements", () => {
  for (const code of ["free", "basic", "pro", "enterprise"]) {
    const plan = PLAN_DEFINITIONS[code];
    assert.equal(plan.code, code);
    assert.equal(typeof plan.invoiceMonthlyLimit, "number");
    assert.equal(typeof plan.staffUserLimit, "number");
    assert.equal(typeof plan.communicationsAccess, "boolean");
    assert.equal(typeof plan.whatsappMonthlyQuota, "number");
    assert.equal(typeof plan.eInvoiceAccess, "boolean");
  }
  const proEntitlements = getPlanEntitlements({ planCode: "pro", addonEntitlements: { extraUsers: 3, whatsappPackage: 250 } });
  assert.equal(proEntitlements.staffUserLimit, PLAN_DEFINITIONS.pro.staffUserLimit + 3);
  assert.equal(proEntitlements.whatsappMonthlyQuota, PLAN_DEFINITIONS.pro.whatsappMonthlyQuota + 250);
});

test("BusinessSubscription remains the source-of-truth schema for status and add-on readiness", () => {
  const statusValues = BusinessSubscription.schema.path("status").enumValues;
  for (const status of ["free", "trial", "active", "past_due", "grace_period", "cancelled", "expired"]) {
    assert.ok(statusValues.includes(status));
  }
  const defaults = getDefaultSubscriptionState("507f1f77bcf86cd799439011", "free");
  assert.equal(defaults.status, "free");
  assert.equal(defaults.planCode, "free");
  assert.ok(BusinessSubscription.schema.path("addonEntitlements.whatsappPackage"));
  assert.ok(BusinessSubscription.schema.path("addonEntitlements.extraUsers"));
});
