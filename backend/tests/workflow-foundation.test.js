const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");

const { moduleCatalog, presets } = require("../src/constants/modules");
const { PLAN_DEFINITIONS, PLAN_FEATURE_MAP } = require("../src/constants/plans");
const { getPlanEntitlements } = require("../src/services/subscription.service");
const Order = require("../src/models/Order");
const Project = require("../src/models/Project");
const Task = require("../src/models/Task");
const RecurringBillingProfile = require("../src/models/RecurringBillingProfile");
const Appointment = require("../src/models/Appointment");
const Invoice = require("../src/models/Invoice");
const MessageDelivery = require("../src/models/MessageDelivery");
const workflow = require("../src/services/workflow.service");
const communication = require("../src/services/communication.service");

const indexExists = (model, fields, options = {}) =>
  model.schema.indexes().some(([indexFields, indexOptions]) => {
    const sameFields = JSON.stringify(indexFields) === JSON.stringify(fields);
    if (!sameFields) return false;
    return Object.entries(options).every(([key, value]) => indexOptions?.[key] === value);
  });

test("P0 workflow modules are registered as implemented add-on modules", () => {
  const modules = new Map(moduleCatalog.map((module) => [module.key, module]));

  [
    "order_management",
    "projects_tasks",
    "recurring_billing",
    "appointments_scheduling",
  ].forEach((moduleKey) => {
    const module = modules.get(moduleKey);
    assert.ok(module, `${moduleKey} should exist in module catalogue`);
    assert.equal(module.status, "IMPLEMENTED");
    assert.equal(module.defaultEnabled, false);
    assert.equal(module.isAddOn, true);
    assert.equal(module.availableForSaas, true);
    assert.equal(module.availableForSelfHosted, true);
  });

  assert.ok(modules.get("order_management").dependencies.includes("invoices"));
  assert.ok(modules.get("recurring_billing").dependencies.includes("invoices"));
  assert.ok(modules.get("appointments_scheduling").dependencies.includes("communications"));
});

test("P0 workflow modules are recommended through existing preset logic", () => {
  assert.ok(presets.TRADING.includes("order_management"));
  assert.ok(presets.MANUFACTURING.includes("order_management"));
  assert.ok(presets.PROJECT_BASED.includes("projects_tasks"));
  assert.ok(presets.RECURRING.includes("recurring_billing"));
  assert.ok(presets.SERVICE.includes("appointments_scheduling"));
});

test("workflow module entitlements are resolved through central plan definitions", () => {
  assert.equal(PLAN_FEATURE_MAP.orderManagement, "orderManagementAccess");
  assert.equal(PLAN_FEATURE_MAP.projectsTasks, "projectsTasksAccess");
  assert.equal(PLAN_FEATURE_MAP.recurringBilling, "recurringBillingAccess");
  assert.equal(PLAN_FEATURE_MAP.appointmentsScheduling, "appointmentsSchedulingAccess");

  assert.equal(PLAN_DEFINITIONS.free.orderManagementAccess, false);
  assert.equal(PLAN_DEFINITIONS.pro.orderManagementAccess, true);
  assert.equal(PLAN_DEFINITIONS.pro.recurringBillingAccess, true);
});

test("workflow add-ons can extend a lower SaaS plan through the existing entitlement resolver", () => {
  const entitlements = getPlanEntitlements({
    planCode: "starter",
    addonEntitlements: {
      workflowModules: ["order_management", "recurring_billing", "appointments_scheduling"],
    },
  });

  assert.equal(entitlements.orderManagementAccess, true);
  assert.equal(entitlements.recurringBillingAccess, true);
  assert.equal(entitlements.appointmentsSchedulingAccess, true);
  assert.equal(entitlements.projectsTasksAccess, false);
});

test("workflow schemas use tenant-scoped identifiers and production indexes", () => {
  assert.equal(indexExists(Order, { businessId: 1, orderNumber: 1 }, { unique: true }), true);
  assert.equal(indexExists(Order, { businessId: 1, quoteId: 1 }, { unique: true }), true);
  assert.equal(indexExists(Project, { businessId: 1, projectNumber: 1 }, { unique: true }), true);
  assert.equal(indexExists(Task, { businessId: 1, assignedTo: 1, status: 1 }), true);
  assert.equal(indexExists(RecurringBillingProfile, { businessId: 1, status: 1, nextBillingDate: 1 }), true);
  assert.equal(indexExists(Appointment, { businessId: 1, assignedUsers: 1, startAt: 1 }), true);
  assert.equal(indexExists(Invoice, { businessId: 1, sourceOrderId: 1 }, { unique: true }), true);
  assert.equal(indexExists(Invoice, { businessId: 1, recurringOccurrenceKey: 1 }, { unique: true }), true);
  assert.equal(indexExists(MessageDelivery, { businessId: 1, status: 1, nextRetryAt: 1 }), true);
  assert.equal(indexExists(MessageDelivery, { businessId: 1, status: 1, lockedAt: 1 }), true);
});

test("workflow lifecycle maps block invalid terminal transitions", () => {
  assert.deepEqual(workflow.ORDER_TRANSITIONS.FULFILLED, []);
  assert.deepEqual(workflow.ORDER_TRANSITIONS.CANCELLED, []);
  assert.deepEqual(workflow.PROJECT_TRANSITIONS.COMPLETED, []);
  assert.deepEqual(workflow.TASK_TRANSITIONS.DONE, []);
  assert.deepEqual(workflow.RECURRING_TRANSITIONS.CANCELLED, []);
  assert.deepEqual(workflow.APPOINTMENT_TRANSITIONS.NO_SHOW, []);
  assert.equal(workflow.ORDER_TRANSITIONS.DRAFT.includes("CONFIRMED"), true);
  assert.equal(workflow.APPOINTMENT_TRANSITIONS.SCHEDULED.includes("CONFIRMED"), true);
});

test("recurring interval helper is deterministic and validates unsafe input", () => {
  const start = new Date("2026-01-31T00:00:00.000Z");

  assert.equal(workflow.addInterval(start, "WEEKLY", 2).toISOString(), "2026-02-14T00:00:00.000Z");
  assert.equal(workflow.addInterval(new Date("2026-01-01T00:00:00.000Z"), "QUARTERLY", 1).getUTCMonth(), 3);
  assert.throws(() => workflow.addInterval(start, "DAILY", 1), /Invalid recurring billing frequency/);
  assert.throws(() => workflow.addInterval(start, "MONTHLY", 0), /positive integer/);
});

test("recurring occurrence keys are document and date scoped", () => {
  const profileId = new mongoose.Types.ObjectId();
  const profile = { _id: profileId, nextBillingDate: new Date("2026-08-31T10:30:00.000Z") };

  assert.equal(workflow.occurrenceKey(profile), `${profileId}:2026-08-31`);
  assert.equal(workflow.occurrenceKey(profile, new Date("2026-09-30T12:00:00.000Z")), `${profileId}:2026-09-30`);
});

test("workflow worker hooks existing scheduler and communication delivery processing", () => {
  assert.equal(typeof workflow.processDueRecurringProfiles, "function");
  assert.equal(typeof communication.scheduleWorkflowMessage, "function");
  assert.equal(typeof communication.processScheduledWorkflowDeliveries, "function");

  const workerSource = fs.readFileSync(path.join(__dirname, "../src/workers/reminder-worker.js"), "utf8");
  assert.match(workerSource, /processDueRecurringProfiles/);
  assert.match(workerSource, /processScheduledWorkflowDeliveries/);
});

test("scheduled workflow deliveries use claimable non-terminal status fields", () => {
  assert.ok(MessageDelivery.schema.path("status").enumValues.includes("PROCESSING"));
  assert.ok(MessageDelivery.schema.path("nextRetryAt"));
  assert.ok(MessageDelivery.schema.path("lockedAt"));
  assert.ok(MessageDelivery.schema.path("lockedBy"));
  assert.ok(MessageDelivery.schema.path("lastAttemptAt"));
});

test("dashboard exposes workflow metrics without changing existing metric fields", () => {
  const dashboardSource = fs.readFileSync(path.join(__dirname, "../src/controllers/dashboard.controller.js"), "utf8");
  assert.match(dashboardSource, /workflowMetrics/);
  assert.match(dashboardSource, /activeOrders/);
  assert.match(dashboardSource, /overdueTasks/);
  assert.match(dashboardSource, /upcomingAppointments/);
  assert.match(dashboardSource, /recurringDueSoon/);
});

test("workflow invoice conversion applies existing stock movement semantics", () => {
  const workflowSource = fs.readFileSync(path.join(__dirname, "../src/services/workflow.service.js"), "utf8");
  assert.match(workflowSource, /applyWorkflowInvoiceStockDeduction/);
  assert.match(workflowSource, /referenceType: "INVOICE"/);
  assert.match(workflowSource, /type: "OUT"/);
  assert.match(workflowSource, /allowNegativeStock/);
});
