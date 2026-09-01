const test = require("node:test");
const assert = require("node:assert/strict");

const { _private } = require("../src/controllers/super-admin.controller");
const { presets } = require("../src/constants/modules");
const moduleService = require("../src/services/module.service");

test("super-admin product configuration serializes authoritative presets", () => {
  const rows = _private.buildPresetConfiguration(presets);

  assert.ok(Array.isArray(rows));
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => typeof row.key === "string"));
  assert.ok(rows.every((row) => Array.isArray(row.moduleKeys)));
});

test("super-admin product configuration tolerates missing optional preset configuration", () => {
  assert.deepEqual(_private.buildPresetConfiguration(null), []);
  assert.deepEqual(_private.buildPresetConfiguration(undefined), []);
  assert.deepEqual(_private.buildPresetConfiguration({ CUSTOM: null }), [{ key: "CUSTOM", moduleKeys: [] }]);
});

test("super-admin controller does not import presets from module service", () => {
  assert.equal(moduleService.presets, undefined);
  assert.ok(Array.isArray(_private.buildPresetConfiguration(presets)));
});
