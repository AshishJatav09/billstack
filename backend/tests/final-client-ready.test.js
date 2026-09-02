const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Business = require("../src/models/Business");
const BusinessSubscription = require("../src/models/BusinessSubscription");
const MessageDelivery = require("../src/models/MessageDelivery");
const IntegrationCredential = require("../src/models/IntegrationCredential");

const src = (...parts) => fs.readFileSync(path.join(__dirname, "..", "src", ...parts), "utf8");
const frontend = (...parts) => fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", ...parts), "utf8");

const query = (value) => ({
  session() {
    return this;
  },
  select() {
    return this;
  },
  sort() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
});

const withPatched = async (patches, fn) => {
  const originals = patches.map(([target, key, value]) => {
    const original = target[key];
    target[key] = value;
    return [target, key, original];
  });
  try {
    return await fn();
  } finally {
    originals.reverse().forEach(([target, key, original]) => {
      target[key] = original;
    });
  }
};

const invokeController = (handler, req = {}) =>
  new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ statusCode: this.statusCode, payload });
      },
    };
    handler(req, res, reject);
  });

test("super admin plan change syncs BusinessSubscription and Business cache Free to Pro", async () => {
  const business = {
    _id: "64f000000000000000000001",
    id: "64f000000000000000000001",
    name: "Acme",
    planCode: "free",
    save: async function save() {
      return this;
    },
  };
  const subscription = {
    _id: "65f000000000000000000001",
    businessId: business._id,
    planCode: "free",
    status: "free",
    addonEntitlements: {},
    save: async function save() {
      return this;
    },
  };

  await withPatched(
    [
      [Business, "findById", () => query(business)],
      [BusinessSubscription, "findOne", () => query(subscription)],
      [MessageDelivery, "aggregate", async () => []],
    ],
    async () => {
      const { updateBusinessPlanBySuperAdmin } = require("../src/controllers/super-admin.controller");
      const result = await invokeController(updateBusinessPlanBySuperAdmin, {
        params: { businessId: business._id },
        body: { planCode: "pro" },
      });
      assert.equal(result.statusCode, 200);
      assert.equal(subscription.planCode, "pro");
      assert.equal(subscription.status, "active");
      assert.equal(business.planCode, "pro");
      assert.equal(result.payload.data.planCode, "pro");
      assert.equal(result.payload.data.entitlements.planCode, "pro");
    }
  );
});

test("super admin plan change syncs Pro to Free without leaving paid entitlements", async () => {
  const business = {
    _id: "64f000000000000000000002",
    id: "64f000000000000000000002",
    name: "Beta",
    planCode: "pro",
    save: async function save() {
      return this;
    },
  };
  const subscription = {
    _id: "65f000000000000000000002",
    businessId: business._id,
    planCode: "pro",
    status: "active",
    addonEntitlements: {},
    save: async function save() {
      return this;
    },
  };

  await withPatched(
    [
      [Business, "findById", () => query(business)],
      [BusinessSubscription, "findOne", () => query(subscription)],
      [MessageDelivery, "aggregate", async () => []],
    ],
    async () => {
      const { updateBusinessPlanBySuperAdmin } = require("../src/controllers/super-admin.controller");
      const result = await invokeController(updateBusinessPlanBySuperAdmin, {
        params: { businessId: business._id },
        body: { planCode: "free" },
      });
      assert.equal(result.payload.data.planCode, "free");
      assert.equal(subscription.status, "free");
      assert.equal(business.planCode, "free");
      assert.equal(result.payload.data.entitlements.inventoryAccess, false);
    }
  );
});

test("current plan response derives entitlements from fresh BusinessSubscription source of truth", async () => {
  const business = {
    _id: "64f000000000000000000003",
    planCode: "free",
    invoiceUsage: { count: 2 },
    businessProfile: {},
  };
  const subscription = {
    _id: "65f000000000000000000003",
    businessId: business._id,
    planCode: "pro",
    status: "active",
    addonEntitlements: {},
    save: async function save() {
      return this;
    },
  };

  await withPatched(
    [
      [BusinessSubscription, "findOne", () => query(subscription)],
      [MessageDelivery, "aggregate", async () => []],
    ],
    async () => {
      const { getCurrentPlan } = require("../src/controllers/plan.controller");
      const result = await invokeController(getCurrentPlan, {
        business,
      });
      assert.equal(result.payload.data.planCode, "pro");
      assert.equal(result.payload.data.entitlements.planCode, "pro");
      assert.equal(result.payload.data.subscription.planCode, "pro");
    }
  );
});

test("integration credentials expose raw API key only on creation and list masked metadata only", () => {
  assert.ok(IntegrationCredential.schema.path("keyHash"));
  const controller = src("controllers", "integration.controller.js");
  const service = src("services", "integration.service.js");
  const settings = frontend("features", "dashboard", "pages", "BusinessSettingsPage.jsx");
  assert.match(controller, /apiKey:\s*result\.rawKey/);
  assert.match(service, /select\("-keyHash"\)/);
  assert.match(settings, /Copy this key now\. It will not be shown again\./);
  assert.match(settings, /keyPrefix\}••••/);
  assert.match(settings, /Revoke integration key\?/);
  assert.doesNotMatch(settings, /window\.(prompt|alert|confirm)/);
  assert.match(settings, /Submit manual UPI payment/);
});

test("super admin production actions no longer use raw browser prompts or confirms", () => {
  const page = frontend("features", "super-admin", "pages", "SuperAdminDashboardPage.jsx");
  assert.doesNotMatch(page, /window\.(prompt|alert|confirm)/);
  assert.match(page, /AdminActionModal/);
  assert.match(page, /ConfirmDialog/);
  assert.match(page, /getModuleDisplayName/);
});

test("subscription page writes authoritative current-plan data back into auth business cache", () => {
  const page = frontend("features", "dashboard", "pages", "SubscriptionPage.jsx");
  assert.match(page, /mergePlanIntoBusiness/);
  assert.match(page, /updateBusiness\(mergePlanIntoBusiness\(business,\s*activePlan\)\)/);
});
