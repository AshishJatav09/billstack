const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const { reportPagination } = require("../src/utils/report-pagination");
const { deriveFinancialState, summarizeInvoiceFinancials } = require("../src/services/financial-read.service");
const { reportDateRange } = require("../src/utils/report-date-range");
test("GST range includes the entire end date and rejects invalid/reversed dates", () => {
  const range = reportDateRange({ from: "2026-09-10", to: "2026-09-10" });
  assert.equal(range.$lt.toISOString(), "2026-09-11T00:00:00.000Z");
  assert.ok(new Date("2026-09-10T23:59:59.999Z") < range.$lt);
  assert.throws(() => reportDateRange({ from: "2026-02-30" }), /valid/);
  assert.throws(() => reportDateRange({ from: "2026-09-11", to: "2026-09-10" }), /From date/);
});
test("GST controller preserves amounts, full end-day records and tenant/cancellation filters", async () => {
  const calls=[];
  const rows=[{ businessId:"tenant", status:"issued", invoiceDate:new Date("2026-09-10T18:00:00Z"), purchaseDate:new Date("2026-09-10T18:00:00Z"), gstBreakup:{cgst:90,sgst:90,taxableValue:1000,hsnSacSummary:{9983:1000}} },{ businessId:"tenant", status:"cancelled", invoiceDate:new Date("2026-09-10"), purchaseDate:new Date("2026-09-10"), gstBreakup:{cgst:9000} }];
  const model={find:filter=>{calls.push(filter);return {select:async()=>rows.filter(row=>row.businessId===filter.businessId&&row.status!==filter.status.$ne&&(!filter.invoiceDate||row.invoiceDate>=filter.invoiceDate.$gte&&row.invoiceDate<filter.invoiceDate.$lt)&&(!filter.purchaseDate||row.purchaseDate>=filter.purchaseDate.$gte&&row.purchaseDate<filter.purchaseDate.$lt))}}};
  const sandbox={module:{exports:{}},require:name=>name.endsWith("/asyncHandler")?fn=>fn:name.endsWith("/report-date-range")?{reportDateRange}:model};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/controllers/gst.controller.js"),"utf8"),sandbox);
  let data;
  await sandbox.module.exports.summary({tenant:{businessId:"tenant"},query:{from:"2026-09-10",to:"2026-09-10"}},{json:payload=>{data=payload.data}});
  assert.equal(data.sales.totalGst,180);assert.equal(data.purchases.totalGst,180);
  assert.equal(data.hsnSacSummary[9983],2000);
  assert.equal(calls.length,2);
});
test("report pagination bounds 3000 records, preserves all pages and validates sizes", () => {
  const rows = Array.from({ length: 3000 }, (_, i) => ({ _id: i }));
  for(const count of [3,30,300,3000])assert.equal(reportPagination(rows.slice(0,count),{},"pending").pagination.total,count);
  assert.equal(reportPagination(rows, {}, "pending").items.length, 10);
  assert.equal(reportPagination(rows, { pendingSize: 25, pendingPage: 120 }, "pending").items.at(-1)._id, 2999);
  assert.equal(reportPagination(rows, { pendingSize: 50, pendingPage: 99 }, "pending").pagination.page, 60);
  for (const size of [0, -1, 100000, "bad"]) assert.equal(reportPagination(rows, { pendingSize: size }, "pending").pagination.limit, 10);
  assert.equal(reportPagination([], {}, "expenses").pagination.total, 0);
});
const runReport = async (invoices, query = {}) => {
  const expenseRows = [{ _id: "Repairs", total: 1180, paid: 1180, unpaid: 0, gstRecorded: 180 }, { _id: "Other", total: 1000, paid: 0, unpaid: 1000, gstRecorded: 0 }];
  const chain = { populate() { return this; }, sort() { return this; }, limit() { return Promise.resolve([]); } };
  const model = { aggregate: async () => [], find: () => chain };
  const customerQueries = [];
  const sandbox = { module: { exports: {} }, require: name => {
    if (name.endsWith("/asyncHandler")) return fn => fn;
    if (name.endsWith("/report-pagination")) return { reportPagination };
    if (name.endsWith("/financial-read.service")) return { getDerivedInvoiceRows: async ({ businessId }) => { assert.equal(businessId, "tenant"); return invoices; }, getDerivedPurchaseRows: async () => [], summarizeInvoiceFinancials };
    if (name.endsWith("/Customer")) return { find: filter => { customerQueries.push(filter); return { select: () => ({ lean: async () => [{ _id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Same name" }, { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", name: "Same name" }] }) }; } };
    if (name.endsWith("/Expense")) return { aggregate: async () => expenseRows };
    if (name.startsWith("../models/")) return model;
    throw new Error(name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/controllers/report.controller.js"), "utf8"), sandbox);
  let data;
  await sandbox.module.exports.getReportsSummary({ user: { businessId: "tenant" }, query }, { status: () => ({ json: payload => { data = payload.data; } }) });
  assert.equal(customerQueries[0].businessId, "tenant");
  return data;
};
test("report collections use derived unpaid/partial/paid state, resolve names and never merge distinct clients", async () => {
  const make = (id, customerId, allocated, status = "issued") => {
    const document = { _id: id, customerId, grandTotal: 11800, amountPaid: 0, balanceDue: 11800, invoiceDate: new Date(), dueDate: new Date(), status };
    const state = deriveFinancialState({ sourceType: "INVOICE", document, migrated: true, allocatedAmount: allocated });
    return { ...document, amountPaid: state.paidAmount, balanceDue: state.outstandingAmount, paymentStatus: state.paymentStatus };
  };
  const rows = [make("unpaid", "aaaaaaaaaaaaaaaaaaaaaaaa", 0), make("partial", "bbbbbbbbbbbbbbbbbbbbbbbb", 4000), make("paid", "bbbbbbbbbbbbbbbbbbbbbbbb", 11800), make("cancelled", "aaaaaaaaaaaaaaaaaaaaaaaa", 0, "cancelled")];
  const data = await runReport(rows);
  assert.equal(data.collectionSummary.totalSales, 35400);
  assert.equal(data.collectionSummary.paidAmount, 15800);
  assert.equal(data.collectionSummary.unpaidAmount, 19600);
  assert.equal(data.monthlySales[0].paidAmount,15800);
  assert.equal(data.customerWiseSales.reduce((sum,row)=>sum+row.balanceDue,0),19600);
  assert.equal(data.pendingPayment.length, 2);
  assert.equal(data.pendingPayment[1].balanceDue, 7800);
  assert.equal(data.pendingPayment[1].paymentStatus, "partial");
  assert.equal(data.customerWiseSales.length, 2);
  assert.equal(data.customerWiseSales[0].customerName, "Same name");
  assert.equal(data.expenseReport.totalExpenses, 2180);
  assert.equal(data.expenseReport.totalExpenseGstRecorded, 180);
  assert.equal(data.expenseReport.totalPaidExpenses, 1180);
});
test("controller pages 3000 pending invoices without truncating totals or returning large documents", async () => {
  const rows = Array.from({ length: 3000 }, (_, i) => ({ _id: String(i).padStart(24, "0"), customerId: "aaaaaaaaaaaaaaaaaaaaaaaa", grandTotal: 100, amountPaid: 0, balanceDue: 100, status: "issued", invoiceDate: new Date(), lineItems: Array(20).fill({ notes: "large" }) }));
  const data = await runReport(rows, { pendingPage: 300 });
  assert.equal(data.pendingPayment.length, 10);
  assert.equal(data.pagination.pending.total, 3000);
  assert.equal(data.pagination.pending.page, 300);
  assert.equal(data.collectionSummary.totalSales, 300000);
  assert.equal(data.pendingPayment[0].lineItems, undefined);
});
test("presentation renders bounded previews/pages, safe names and compact Indian currency", async () => {
  const view = await import(pathToFileURL(path.join(__dirname, "../../frontend/src/features/dashboard/reportPresentation.js")).href);
  const rows = Array.from({ length: 3000 }, (_, id) => ({ id }));
  assert.equal(view.reportRows(rows, { page: 1, limit: 10 }, true, false).length, 5);
  assert.equal(view.reportRows(rows, { page: 2, limit: 10 }, false, false)[0].id, 10);
  assert.equal(view.safeName("aaaaaaaaaaaaaaaaaaaaaaaa", "Unknown client"), "Unknown client");
  assert.match(view.compactMoney(105000), /1.05/);
  assert.match(view.money(11800), /11,800/);
});
