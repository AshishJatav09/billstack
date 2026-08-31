const test = require("node:test");
const assert = require("node:assert/strict");

const {
  coreModuleKeys,
  getDeploymentMode,
  moduleCatalog,
  presets,
} = require("../src/constants/modules");
const { getPresetRecommendations } = require("../src/services/module.service");

test("module catalogue maps real implemented BillStack modules", () => {
  const implemented = new Set(
    moduleCatalog.filter((module) => module.status === "IMPLEMENTED").map((module) => module.key)
  );

  [
    "customers",
    "products_services",
    "invoices",
    "payments",
    "ledger",
    "gst",
    "reports",
    "quotations",
    "inventory",
    "suppliers",
    "purchases",
    "sales_returns",
    "credit_notes",
    "communications",
    "hr",
  ].forEach((moduleKey) => assert.equal(implemented.has(moduleKey), true));
});

test("future modules are request-required and not marked as implemented", () => {
  const future = moduleCatalog.filter((module) => module.category === "FUTURE");

  assert.ok(future.length);
  future.forEach((module) => {
    assert.equal(module.status, "REQUEST_REQUIRED");
    assert.equal(module.defaultEnabled, false);
  });
});

test("core modules are protected from accidental disablement", () => {
  ["customers", "invoices", "payments", "ledger", "settings"].forEach((moduleKey) =>
    assert.equal(coreModuleKeys.includes(moduleKey), true)
  );
});

test("preset recommendations are configuration-driven", () => {
  const service = getPresetRecommendations("SERVICE");
  const trading = getPresetRecommendations("TRADING");

  assert.equal(service.preset, "SERVICE");
  assert.equal(service.moduleKeys.includes("quotations"), true);
  assert.equal(service.moduleKeys.includes("communications"), true);
  assert.equal(trading.moduleKeys.includes("inventory"), true);
  assert.equal(trading.moduleKeys.includes("purchases"), true);
  assert.equal(presets.CUSTOM.length, 0);
});

test("deployment mode defaults to SaaS and supports self-hosted", () => {
  const previous = process.env.BILLSTACK_DEPLOYMENT_MODE;

  delete process.env.BILLSTACK_DEPLOYMENT_MODE;
  assert.equal(getDeploymentMode(), "SAAS");

  process.env.BILLSTACK_DEPLOYMENT_MODE = "SELF_HOSTED";
  assert.equal(getDeploymentMode(), "SELF_HOSTED");

  if (previous === undefined) {
    delete process.env.BILLSTACK_DEPLOYMENT_MODE;
  } else {
    process.env.BILLSTACK_DEPLOYMENT_MODE = previous;
  }
});
