const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const lifecycle = require("../src/services/sales-lifecycle.service");
const CreditNote = require("../src/models/CreditNote");
const SalesReturn = require("../src/models/SalesReturn");
const CustomerLedger = require("../src/models/CustomerLedger");

test("production sales lifecycle exports credit-note and return workflows", () => {
  assert.equal(typeof lifecycle.createCreditNote, "function");
  assert.equal(typeof lifecycle.createSalesReturn, "function");
  assert.equal(typeof lifecycle.listCreditNotes, "function");
  assert.equal(typeof lifecycle.listSalesReturns, "function");
});

test("sales lifecycle routes enforce module and plan entitlement gates", () => {
  const routeSource = fs.readFileSync(path.join(__dirname, "../src/routes/sales-lifecycle.routes.js"), "utf8");
  assert.match(routeSource, /requireModule\("credit_notes"\)/);
  assert.match(routeSource, /requireFeature\("creditNotes"\)/);
  assert.match(routeSource, /requireModule\("sales_returns"\)/);
  assert.match(routeSource, /requireFeature\("salesReturns"\)/);
});

test("quote routes enforce module and plan entitlement gates", () => {
  const routeSource = fs.readFileSync(path.join(__dirname, "../src/routes/quote.routes.js"), "utf8");
  assert.match(routeSource, /requireModule\("quotations"\)/);
  assert.match(routeSource, /requireFeature\("quotations"\)/);
});

test("credit notes and sales returns enforce immutable persistence and tenant indexes", () => {
  assert.ok(CreditNote.schema.indexes().some(([fields, options]) => fields.businessId === 1 && fields.creditNoteNumber === 1 && options.unique));
  assert.ok(SalesReturn.schema.indexes().some(([fields, options]) => fields.businessId === 1 && fields.returnNumber === 1 && options.unique));
  assert.ok(CustomerLedger.schema.indexes().some(([fields, options]) => fields.businessId === 1 && fields.sourceKey === 1 && options.unique));
});

test("credit-note and sales-return transaction scenarios require a replica-set database", { skip: "Transaction integration tests unavailable because no replica-set test database exists." }, () => {});

for (const name of [
  "partial credit", "full credit", "over-credit rejection", "invoice-line remaining eligibility",
  "repeated credit creation", "credit ledger idempotency", "tenant-isolated credit note",
  "valid sales return", "return quantity limit", "return inventory restoration",
  "return ledger idempotency", "repeated sales return", "tenant-isolated sales return",
]) {
  test(`production-path integration: ${name}`, { skip: "Transaction integration tests unavailable because no replica-set test database exists." }, () => {});
}
