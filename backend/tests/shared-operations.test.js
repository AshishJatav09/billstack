const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { moduleCatalog, presets } = require("../src/constants/modules");
const { PLAN_DEFINITIONS, PLAN_FEATURE_MAP } = require("../src/constants/plans");
const { getPlanEntitlements } = require("../src/services/subscription.service");
const ApprovalDocument = require("../src/models/ApprovalDocument");
const DispatchFulfilment = require("../src/models/DispatchFulfilment");
const ProductBatch = require("../src/models/ProductBatch");
const ProductionJob = require("../src/models/ProductionJob");
const service = require("../src/services/shared-operations.service");

const indexExists = (model, fields, options = {}) =>
  model.schema.indexes().some(([indexFields, indexOptions]) => {
    const sameFields = JSON.stringify(indexFields) === JSON.stringify(fields);
    if (!sameFields) return false;
    return Object.entries(options).every(([key, value]) => indexOptions?.[key] === value);
  });

test("P1 shared operations are reusable implemented modules, not industry-specific packs", () => {
  const modules = new Map(moduleCatalog.map((module) => [module.key, module]));
  [
    "production_job_work",
    "batch_expiry",
    "dispatch_fulfilment",
    "documents_approvals",
  ].forEach((moduleKey) => {
    const module = modules.get(moduleKey);
    assert.ok(module, `${moduleKey} exists`);
    assert.equal(module.category, "WORKFLOW");
    assert.equal(module.status, "IMPLEMENTED");
    assert.equal(module.isAddOn, true);
    assert.equal(module.availableForSaas, true);
    assert.equal(module.availableForSelfHosted, true);
    assert.notEqual(module.isIndustrySpecific, true);
  });

  assert.ok(modules.get("production_job_work").dependencies.includes("inventory"));
  assert.ok(modules.get("batch_expiry").dependencies.includes("inventory"));
  assert.ok(modules.get("dispatch_fulfilment").dependencies.includes("order_management"));
  assert.ok(modules.get("documents_approvals").dependencies.includes("audit"));
});

test("P1 shared operation entitlements are centralized and add-on aware", () => {
  assert.equal(PLAN_FEATURE_MAP.productionJobWork, "productionJobWorkAccess");
  assert.equal(PLAN_FEATURE_MAP.batchExpiry, "batchExpiryAccess");
  assert.equal(PLAN_FEATURE_MAP.dispatchFulfilment, "dispatchFulfilmentAccess");
  assert.equal(PLAN_FEATURE_MAP.documentsApprovals, "documentsApprovalsAccess");

  assert.equal(PLAN_DEFINITIONS.free.productionJobWorkAccess, false);
  assert.equal(PLAN_DEFINITIONS.growth.batchExpiryAccess, true);
  assert.equal(PLAN_DEFINITIONS.pro.productionJobWorkAccess, true);

  const entitlements = getPlanEntitlements({
    planCode: "starter",
    addonEntitlements: {
      workflowModules: ["production_job_work", "documents_approvals"],
    },
  });

  assert.equal(entitlements.productionJobWorkAccess, true);
  assert.equal(entitlements.documentsApprovalsAccess, true);
  assert.equal(entitlements.batchExpiryAccess, false);
});

test("P1 shared operation schemas have tenant, source-key and operational indexes", () => {
  assert.equal(indexExists(ProductionJob, { businessId: 1, jobNumber: 1 }, { unique: true }), true);
  assert.equal(indexExists(ProductionJob, { businessId: 1, sourceKey: 1 }, { unique: true }), true);
  assert.equal(indexExists(ProductionJob, { businessId: 1, status: 1, stockApplied: 1 }), true);
  assert.equal(indexExists(ProductBatch, { businessId: 1, productId: 1, batchNumber: 1 }, { unique: true }), true);
  assert.equal(indexExists(ProductBatch, { businessId: 1, sourceKey: 1 }, { unique: true }), true);
  assert.equal(indexExists(ProductBatch, { businessId: 1, status: 1, expiryDate: 1 }), true);
  assert.equal(indexExists(DispatchFulfilment, { businessId: 1, dispatchNumber: 1 }, { unique: true }), true);
  assert.equal(indexExists(DispatchFulfilment, { businessId: 1, sourceKey: 1 }, { unique: true }), true);
  assert.equal(indexExists(ApprovalDocument, { businessId: 1, sourceKey: 1 }, { unique: true }), true);
  assert.equal(indexExists(ApprovalDocument, { businessId: 1, sourceType: 1, sourceId: 1 }), true);
});

test("P1 shared operation lifecycle maps protect terminal states", () => {
  assert.deepEqual(service.PRODUCTION_TRANSITIONS.COMPLETED, []);
  assert.deepEqual(service.BATCH_TRANSITIONS.EXPIRED, []);
  assert.deepEqual(service.DISPATCH_TRANSITIONS.DELIVERED, []);
  assert.deepEqual(service.APPROVAL_TRANSITIONS.APPROVED, []);
  assert.equal(service.DISPATCH_TRANSITIONS.PACKED.includes("DISPATCHED"), true);
  assert.equal(service.APPROVAL_TRANSITIONS.PENDING.includes("REJECTED"), true);
});

test("P1 shared operation APIs are mounted with module and entitlement gates", () => {
  const routeSource = fs.readFileSync(path.join(__dirname, "../src/routes/shared-operations.routes.js"), "utf8");
  assert.match(routeSource, /requireModule\("production_job_work"\)/);
  assert.match(routeSource, /requireFeature\("productionJobWork"\)/);
  assert.match(routeSource, /requireModule\("batch_expiry"\)/);
  assert.match(routeSource, /requireFeature\("batchExpiry"\)/);
  assert.match(routeSource, /requireModule\("dispatch_fulfilment"\)/);
  assert.match(routeSource, /requireFeature\("dispatchFulfilment"\)/);
  assert.match(routeSource, /requireModule\("documents_approvals"\)/);
  assert.match(routeSource, /requireFeature\("documentsApprovals"\)/);

  const appSource = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
  assert.match(appSource, /\/api\/shared-operations/);
});

test("shared operations reuse stock movements and audit logs instead of duplicating engines", () => {
  const serviceSource = fs.readFileSync(path.join(__dirname, "../src/services/shared-operations.service.js"), "utf8");
  assert.match(serviceSource, /StockMovement/);
  assert.match(serviceSource, /buildInventoryFlags/);
  assert.match(serviceSource, /writeAuditLog/);
  assert.doesNotMatch(serviceSource, /amountPaid|paidAmount|PaymentAllocation\.create/);
});

test("production completion atomically claims stock application before stock movements", () => {
  const serviceSource = fs.readFileSync(path.join(__dirname, "../src/services/shared-operations.service.js"), "utf8");
  const completionStart = serviceSource.indexOf('if (next === "COMPLETED")');
  const completionBlock = serviceSource.slice(completionStart, serviceSource.indexOf('if (next === "IN_PROGRESS")'));

  assert.match(completionBlock, /ProductionJob\.findOneAndUpdate/);
  assert.match(completionBlock, /stockApplied:\s*\{\s*\$ne:\s*true\s*\}/);
  assert.match(completionBlock, /stockApplied:\s*true/);
  assert.match(completionBlock, /applyStockDelta/);
  assert.match(completionBlock, /already been applied or status changed/);
});

test("dispatch lifecycle does not own stock deduction or duplicate invoice inventory effects", () => {
  const serviceSource = fs.readFileSync(path.join(__dirname, "../src/services/shared-operations.service.js"), "utf8");
  const dispatchBlock = serviceSource.slice(serviceSource.indexOf("const createDispatch"), serviceSource.indexOf("const listDispatches"));
  const dispatchStatusBlock = serviceSource.slice(serviceSource.indexOf("const setDispatchStatus"), serviceSource.indexOf("const createApprovalDocument"));

  assert.doesNotMatch(dispatchBlock, /applyStockDelta|StockMovement\.create/);
  assert.doesNotMatch(dispatchStatusBlock, /applyStockDelta|StockMovement\.create/);
  assert.match(dispatchBlock, /Dispatch customer does not match order/);
  assert.match(dispatchBlock, /Dispatch customer does not match invoice/);
  assert.match(dispatchBlock, /ORDER:\$\{order\._id\}:DISPATCH/);
  assert.match(dispatchBlock, /INVOICE:\$\{invoice\._id\}:DISPATCH/);
});

test("batch and expiry workflow validates source linkage without mutating stock", () => {
  const serviceSource = fs.readFileSync(path.join(__dirname, "../src/services/shared-operations.service.js"), "utf8");
  const createBatchBlock = serviceSource.slice(serviceSource.indexOf("const createBatch"), serviceSource.indexOf("const listBatches"));
  const listBatchBlock = serviceSource.slice(serviceSource.indexOf("const listBatches"), serviceSource.indexOf("const setBatchStatus"));
  const batchStatusBlock = serviceSource.slice(serviceSource.indexOf("const setBatchStatus"), serviceSource.indexOf("const createDispatch"));

  assert.match(createBatchBlock, /Batch number is required/);
  assert.match(createBatchBlock, /Batch quantity/);
  assert.match(createBatchBlock, /PURCHASE:\$\{payload\.sourcePurchaseId\}:PRODUCT:\$\{product\._id\}:BATCH:\$\{batchNumber\}/);
  assert.match(listBatchBlock, /expiringWithinDays/);
  assert.doesNotMatch(createBatchBlock, /applyStockDelta|StockMovement\.create/);
  assert.doesNotMatch(batchStatusBlock, /applyStockDelta|StockMovement\.create/);
});

test("documents and approvals validate tenant-scoped sources and approver authority", () => {
  const serviceSource = fs.readFileSync(path.join(__dirname, "../src/services/shared-operations.service.js"), "utf8");

  assert.match(serviceSource, /const validateApprovalSource/);
  assert.match(serviceSource, /ORDER:\s*Order/);
  assert.match(serviceSource, /INVOICE:\s*Invoice/);
  assert.match(serviceSource, /PURCHASE:\s*Purchase/);
  assert.match(serviceSource, /PROJECT:\s*Project/);
  assert.match(serviceSource, /TASK:\s*Task/);
  assert.match(serviceSource, /findOne\(\{\s*_id:\s*sourceId,\s*businessId\s*\}\)/);
  assert.match(serviceSource, /Only assigned approvers can approve or reject this document/);
  assert.match(serviceSource, /APPROVAL:\$\{source\.sourceType\}:\$\{source\.sourceId\}/);
});

test("dashboard shared workflow metrics exclude terminal records", () => {
  const dashboardSource = fs.readFileSync(path.join(__dirname, "../src/controllers/dashboard.controller.js"), "utf8");

  assert.match(dashboardSource, /ProductionJob\.countDocuments\(\{\s*businessId,\s*status:\s*\{\s*\$in:\s*\["PLANNED",\s*"IN_PROGRESS"\]\s*\}\s*\}\)/);
  assert.match(dashboardSource, /ProductBatch\.countDocuments\(\{\s*businessId,\s*status:\s*"ACTIVE"/);
  assert.match(dashboardSource, /DispatchFulfilment\.countDocuments\(\{\s*businessId,\s*status:\s*\{\s*\$in:\s*\["DRAFT",\s*"PACKED",\s*"DISPATCHED"\]\s*\}\s*\}\)/);
  assert.match(dashboardSource, /ApprovalDocument\.countDocuments\(\{\s*businessId,\s*status:\s*"PENDING"\s*\}\)/);
});

test("business presets can recommend shared operations without making them mandatory core", () => {
  assert.ok(presets.MANUFACTURING.includes("production_job_work"));
  assert.ok(presets.MANUFACTURING.includes("batch_expiry"));
  assert.ok(presets.MANUFACTURING.includes("dispatch_fulfilment"));
  assert.ok(presets.PROJECT_BASED.includes("documents_approvals"));
});
