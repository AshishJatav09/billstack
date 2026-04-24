const test = require("node:test");
const assert = require("node:assert/strict");

const tenantMiddleware = require("../src/middlewares/tenant.middleware");
const { PLAN_DEFINITIONS } = require("../src/constants/plans");

test("tenant middleware blocks cross-business header access", () => {
  const req = {
    user: {
      businessId: {
        toString: () => "tenant-123",
      },
    },
    headers: {
      "x-business-id": "other-tenant",
    },
    params: {},
  };

  assert.throws(() => tenantMiddleware(req, {}, () => {}), /Cross-business access is not allowed/);
});

test("free plan invoice limit stays capped at 20", () => {
  assert.equal(PLAN_DEFINITIONS.free.invoiceMonthlyLimit, 20);
});
