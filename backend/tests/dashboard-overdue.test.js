const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { isOverdueByBusinessDate } = require("../src/utils/business-date");
const { pathToFileURL } = require("node:url");

test("Real Estate client hides project/task surfaces even when their module is active; SaaS keeps them", async () => {
  const visibility = await import(pathToFileURL(path.join(__dirname, "../../frontend/src/features/workspace/workspaceVisibility.js")).href);
  const modules = { deploymentMode: "SELF_HOSTED", businessProfile: { industryCode: "REAL_ESTATE" }, catalog: [{ key: "projects_tasks", state: "ACTIVE" }] };
  assert.equal(visibility.isActiveModule(modules, "projects_tasks"), true);
  assert.equal(visibility.shouldShowWorkspaceNavigation("projects_tasks", modules), false);
  assert.equal(visibility.shouldShowDashboardSurface("projects_tasks", modules), false);
  const saas = { ...modules, deploymentMode: "SAAS" };
  assert.equal(visibility.shouldShowWorkspaceNavigation("projects_tasks", saas), true);
  assert.equal(visibility.shouldShowDashboardSurface("projects_tasks", saas), true);
});

test("dashboard overdue total covers all derived invoices, not only the five recent rows", async () => {
  const yesterday = new Date(Date.now() - 86400000);
  const rows = Array.from({ length: 7 }, (_, index) => ({
    _id: String(index), status: "issued", paymentStatus: "partial",
    grandTotal: 200, amountPaid: 100, balanceDue: 100,
    dueDate: yesterday, invoiceDate: new Date(Date.now() - index * 86400000),
  }));
  rows.push({ _id: "cancelled", status: "cancelled", grandTotal: 9000, amountPaid: 0, balanceDue: 9000, dueDate: yesterday });
  rows.push({ _id: "today", status: "issued", grandTotal: 300, amountPaid: 0, balanceDue: 300, dueDate: new Date() });
  rows.push({ _id: "paid", status: "issued", grandTotal: 200, amountPaid: 200, balanceDue: 0, dueDate: yesterday });
  const query = { populate() { return this; }, sort() { return this; }, limit() { return Promise.resolve([]); } };
  const model = { aggregate: async () => [], find: () => query, countDocuments: async () => 0 };
  const expense = { aggregate: async () => [{ paidExpenses: 50 }] };
  const sandbox = {
    module: { exports: {} }, Date, Map,
    require: (name) => {
      if (name === "mongoose") return { Types: { ObjectId: class { constructor(id) { this.id = id; } } } };
      if (name.endsWith("/asyncHandler")) return (fn) => fn;
      if (name.endsWith("/financial-read.service")) return { getDerivedInvoiceRows: async () => rows };
      if (name.endsWith("/business-date")) return { isOverdueByBusinessDate };
      if (name.endsWith("/Expense")) return expense;
      if (name.startsWith("../models/")) return model;
      throw new Error(name);
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/controllers/dashboard.controller.js"), "utf8"), sandbox);
  let result;
  await sandbox.module.exports.getDashboardSummary(
    { tenant: { businessId: "business" }, user: { businessId: "business" } },
    { status: () => ({ json: (payload) => { result = payload.data; } }) }
  );
  assert.equal(result.recentInvoices.length, 5);
  assert.equal(result.metrics.overdueAmount, 700);
  assert.equal(result.metrics.overdueInvoices, 7);
  assert.equal(result.metrics.totalSales, 1900);
  assert.equal(result.metrics.paidAmount, 900);
  assert.equal(result.metrics.unpaidAmount, 1000);
  assert.equal(result.metrics.netOperatingDifference, 1850);
  assert.equal(new Set(result.recentInvoices.map(row => row._id)).size, 5);
});
