const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { MODULE_STATES, moduleCatalog } = require("../src/constants/modules");
const { _private } = require("../src/services/module.service");
const selfHostedProfile = require("../src/services/self-hosted-profile.service");
const Invoice = require("../src/models/Invoice");
const { invoiceCreateValidator } = require("../src/validators/resource.validation");
const { buildGstSnapshot } = require("../src/utils/gst");

const byKey = (key) => moduleCatalog.find((module) => module.key === key);

test("profile-scoped workspace activates preset modules without globally exposing unrelated modules", () => {
  const business = {
    businessProfile: {
      onboardingStatus: "COMPLETED",
      recommendedModules: ["customers", "invoices", "payments", "ledger", "expenses", "reports"],
    },
  };

  assert.equal(_private.resolveDefaultModuleState({ business, moduleMeta: byKey("customers") }), MODULE_STATES.ACTIVE);
  assert.equal(_private.resolveDefaultModuleState({ business, moduleMeta: byKey("expenses") }), MODULE_STATES.ACTIVE);
  assert.equal(_private.resolveDefaultModuleState({ business, moduleMeta: byKey("inventory") }), MODULE_STATES.AVAILABLE);
  assert.equal(_private.resolveDefaultModuleState({ business, moduleMeta: byKey("production_job_work") }), MODULE_STATES.REQUEST_REQUIRED);
});

test("explicit BusinessModuleConfig continues to win over preset-derived defaults", () => {
  const business = {
    businessProfile: {
      onboardingStatus: "COMPLETED",
      recommendedModules: ["customers", "invoices"],
    },
  };

  const serialized = _private.serializeModuleConfig({
    business,
    deploymentMode: "SAAS",
    moduleMeta: byKey("inventory"),
    config: { state: MODULE_STATES.ACTIVE, source: "SETTINGS" },
  });

  assert.equal(serialized.state, MODULE_STATES.ACTIVE);
  assert.equal(serialized.active, true);
  assert.equal(serialized.explicitConfig, true);
  assert.equal(serialized.defaultSource, "SETTINGS");
});

test("legacy businesses without profile-scoped workspace keep existing default compatibility", () => {
  const business = { businessProfile: { onboardingStatus: "NOT_STARTED", recommendedModules: [] } };

  assert.equal(_private.resolveDefaultModuleState({ business, moduleMeta: byKey("inventory") }), MODULE_STATES.ACTIVE);
});

test("sidebar and dashboard fail closed instead of flashing every module", () => {
  const sidebar = fs.readFileSync(path.join(__dirname, "../../frontend/src/components/layout/Sidebar.jsx"), "utf8");
  const dashboard = fs.readFileSync(path.join(__dirname, "../../frontend/src/features/dashboard/pages/DashboardHomePage.jsx"), "utf8");

  assert.doesNotMatch(sidebar, /!moduleKey\s*\|\|\s*!moduleData\)\s*return true/);
  assert.match(sidebar, /moduleStatus !== "success" && moduleKey\) return false/);
  assert.match(sidebar, /NAV_GROUPS/);
  assert.match(dashboard, /getBusinessModulesRequest/);
  assert.match(dashboard, /workflowStats[\s\S]*\.filter\(\(item\) => showModule\(item\.moduleKey\)\)/);
  assert.doesNotMatch(dashboard, /Record payment[\s\S]*Coming soon/);
});

test("self-hosted attribution is present without exposing secrets", () => {
  const authLayout = fs.readFileSync(path.join(__dirname, "../../frontend/src/components/layout/AuthLayout.jsx"), "utf8");
  const envTemplate = fs.readFileSync(path.join(__dirname, "../../frontend/.env.production.example"), "utf8");

  assert.match(authLayout, /VITE_BILLSTACK_DEPLOYMENT_MODE/);
  assert.match(authLayout, /VITE_POWERED_BY_TEXT/);
  assert.match(envTemplate, /VITE_POWERED_BY_TEXT=Powered by Nemnidhi Digital Solutions/);
  assert.doesNotMatch(envTemplate, /SECRET|PASSWORD|TOKEN/);
});

test("SELF_HOSTED registration uses deployment-mode source of truth instead of creating SaaS workspace", () => {
  const authController = fs.readFileSync(path.join(__dirname, "../src/controllers/auth.controller.js"), "utf8");

  assert.match(authController, /getDeploymentMode/);
  assert.match(authController, /deploymentMode:\s*getDeploymentMode\(\)/);
  assert.match(authController, /ensureSelfHostedBusinessProfile\(business\)/);
  assert.match(authController, /startTrialForNewBusiness/);
});

test("SELF_HOSTED registration auto-configures Real Estate profile defaults", () => {
  const profile = selfHostedProfile.getSelfHostedDefaultProfilePayload();
  const resolved = _private.resolveWorkspacePreset
    ? _private.resolveWorkspacePreset(profile)
    : require("../src/services/module.service").resolveWorkspacePreset(profile);

  assert.equal(profile.industryCode, "REAL_ESTATE");
  assert.equal(profile.playerTypeCode, "BROKER");
  assert.equal(profile.businessModel, "SERVICE");
  assert.ok(profile.selectedNeeds.includes("RECURRING_BILLING"));
  assert.equal(profile.selectedNeeds.includes("APPOINTMENTS"), false);
  assert.ok(resolved.recommendedModules.includes("recurring_billing"));
  assert.ok(resolved.recommendedModules.includes("quotations"));
  assert.ok(resolved.recommendedModules.includes("invoices"));
});

test("SELF_HOSTED login/current-session backfills profile only when server profile is incomplete", () => {
  const authController = fs.readFileSync(path.join(__dirname, "../src/controllers/auth.controller.js"), "utf8");
  const incomplete = {
    deploymentMode: "SELF_HOSTED",
    onboardingCompleted: false,
    businessProfile: { onboardingStatus: "NOT_STARTED", recommendedModules: [] },
  };
  const complete = {
    deploymentMode: "SELF_HOSTED",
    onboardingCompleted: true,
    businessProfile: { onboardingStatus: "COMPLETED", industryCode: "REAL_ESTATE", recommendedModules: ["invoices"] },
  };

  assert.equal(selfHostedProfile._private.needsSelfHostedProfile(incomplete), true);
  assert.equal(selfHostedProfile._private.needsSelfHostedProfile(complete), false);
  assert.match(authController, /business = await ensureSelfHostedBusinessProfile\(business\)/);
});

test("Real Estate SELF_HOSTED workspace hides irrelevant operational modules from primary navigation", () => {
  const visibility = fs.readFileSync(path.join(__dirname, "../../frontend/src/features/workspace/workspaceVisibility.js"), "utf8");
  const sidebar = fs.readFileSync(path.join(__dirname, "../../frontend/src/components/layout/Sidebar.jsx"), "utf8");
  const dashboard = fs.readFileSync(path.join(__dirname, "../../frontend/src/features/dashboard/pages/DashboardHomePage.jsx"), "utf8");

  assert.match(visibility, /isRealEstateSelfHostedWorkspace/);
  assert.match(visibility, /REAL_ESTATE_CLIENT_HIDDEN_NAV_MODULES/);
  assert.match(visibility, /"products_services"/);
  assert.match(visibility, /"inventory"/);
  assert.match(visibility, /"suppliers"/);
  assert.match(visibility, /"purchases"/);
  assert.match(visibility, /"appointments_scheduling"/);
  assert.match(visibility, /"production_job_work"/);
  assert.match(sidebar, /shouldShowWorkspaceNavigation/);
  assert.match(dashboard, /shouldShowDashboardSurface/);
  assert.match(dashboard, /New site visit/);
  assert.match(dashboard, /Monthly billing due/);
});

test("SELF_HOSTED configured businesses bypass generic SaaS onboarding from auth routing", () => {
  const protectedRoute = fs.readFileSync(path.join(__dirname, "../../frontend/src/components/ui/ProtectedRoute.jsx"), "utf8");
  const guestRoute = fs.readFileSync(path.join(__dirname, "../../frontend/src/components/ui/GuestRoute.jsx"), "utf8");
  const useAuth = fs.readFileSync(path.join(__dirname, "../../frontend/src/features/auth/useAuth.js"), "utf8");

  assert.match(protectedRoute, /currentSessionRequest/);
  assert.match(protectedRoute, /location\.pathname === "\/onboarding"/);
  assert.match(protectedRoute, /Navigate to="\/dashboard"/);
  assert.match(guestRoute, /currentSessionRequest/);
  assert.match(guestRoute, /business\?\.deploymentMode === "SELF_HOSTED"/);
  assert.match(useAuth, /resolvePostAuthRoute/);
  assert.match(useAuth, /businessPayload\?\.deploymentMode === "SELF_HOSTED"/);
});

test("stale persisted frontend business cannot decide onboarding before fresh session check", () => {
  const protectedRoute = fs.readFileSync(path.join(__dirname, "../../frontend/src/components/ui/ProtectedRoute.jsx"), "utf8");
  const guestRoute = fs.readFileSync(path.join(__dirname, "../../frontend/src/components/ui/GuestRoute.jsx"), "utf8");

  assert.match(protectedRoute, /sessionStatus === "checking"/);
  assert.match(protectedRoute, /setSession\(\{\s*accessToken,\s*user: data\.user,\s*business: data\.business/s);
  assert.match(guestRoute, /sessionStatus === "checking"/);
  assert.match(guestRoute, /setSession\(\{\s*accessToken,\s*user: data\.user,\s*business: data\.business/s);
});

test("SaaS onboarding remains available for incomplete SaaS businesses", () => {
  const protectedRoute = fs.readFileSync(path.join(__dirname, "../../frontend/src/components/ui/ProtectedRoute.jsx"), "utf8");

  assert.match(protectedRoute, /!isSelfHosted && !business\?\.onboardingCompleted && requireOnboardingComplete/);
  assert.match(protectedRoute, /Navigate to="\/onboarding"/);
});

test("hidden Real Estate navigation does not remove backend module activation or route guards", () => {
  const visibility = fs.readFileSync(path.join(__dirname, "../../frontend/src/features/workspace/workspaceVisibility.js"), "utf8");
  const moduleService = fs.readFileSync(path.join(__dirname, "../src/services/module.service.js"), "utf8");
  const routeModules = fs.readFileSync(path.join(__dirname, "../../frontend/src/features/workspace/workspaceVisibility.js"), "utf8");

  assert.match(visibility, /shouldShowWorkspaceNavigation/);
  assert.match(moduleService, /resolveDefaultModuleState/);
  assert.match(moduleService, /BusinessModuleConfig\.findOne/);
  assert.match(routeModules, /"\/dashboard\/products": "products_services"/);
  assert.match(routeModules, /"\/dashboard\/sales-returns": "sales_returns"/);
});

test("invoice schema and validator allow manual service lines without productId", async () => {
  const validation = invoiceCreateValidator({
    customerId: "customer-id",
    lineItems: [{ productName: "Consulting service", quantity: 2, rate: 500, taxRate: 18 }],
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.errors["lineItems.0.productId"], undefined);

  const invoice = new Invoice({
    businessId: "64f000000000000000000001",
    customerId: "64f000000000000000000002",
    invoiceNumber: "INV-MANUAL-1",
    invoiceDate: new Date(),
    dueDate: new Date(),
    lineItems: [{ productId: null, productName: "Consulting service", quantity: 2, rate: 500, taxRate: 18, itemTotal: 1180, isManual: true }],
    subtotal: 1000,
    grandTotal: 1180,
    createdBy: "64f000000000000000000003",
  });

  await assert.doesNotReject(() => invoice.validate());
});

test("manual invoice lines keep GST snapshot data without requiring product master data", () => {
  const snapshot = buildGstSnapshot({
    business: { gstConfiguration: { enabled: true, gstin: "27ABCDE1234F1Z5", stateCode: "27" } },
    counterparty: { stateCode: "29" },
    products: [],
    lineItems: [{ productId: null, productName: "One-off service", taxableAmount: 1000, lineTotal: 1180, taxRate: 18, hsnSac: "9983", gstClassification: "TAXABLE" }],
  });

  assert.equal(snapshot.igst, 180);
  assert.equal(snapshot.lines[0].hsnSac, "9983");
  assert.equal(snapshot.lines[0].gstClassification, "TAXABLE");
  assert.equal(snapshot.hsnSacSummary["9983"], 1000);
});

test("fast invoice UI exposes inline customer, manual lines, save-for-future, issue-send, and payment workflow", () => {
  const invoicePage = fs.readFileSync(path.join(__dirname, "../../frontend/src/features/dashboard/pages/InvoicesPage.jsx"), "utf8");
  const invoiceController = fs.readFileSync(path.join(__dirname, "../src/controllers/invoice.controller.js"), "utf8");

  assert.match(invoicePage, /createCustomerRequest/);
  assert.match(invoicePage, /Add new customer/);
  assert.match(invoicePage, /Manual \/ one-off/);
  assert.match(invoicePage, /saveForFuture/);
  assert.match(invoicePage, /createProductRequest/);
  assert.match(invoicePage, /Issue & Send/);
  assert.match(invoicePage, /Issue & Record Payment/);
  assert.match(invoicePage, /recordPaymentAfterIssue/);
  assert.match(invoicePage, /createPaymentRequest/);
  assert.match(invoicePage, /allocatePaymentRequest/);
  assert.doesNotMatch(invoicePage, /name="amountPaid"|Amount paid/);
  assert.doesNotMatch(invoicePage, /window\.prompt/);
  assert.match(invoiceController, /if \(!item\.productId\) return/);
  assert.match(invoiceController, /productId: product\?\._id \|\| null/);
});

test("client invoice payment menu is portal-based and payment submit recovers cleanly", () => {
  const invoicePage = fs.readFileSync(path.join(__dirname, "../../frontend/src/features/dashboard/pages/InvoicesPage.jsx"), "utf8");
  const paymentService = fs.readFileSync(path.join(__dirname, "../src/services/payment.service.js"), "utf8");

  assert.match(invoicePage, /createPortal/);
  assert.match(invoicePage, /toggleActionMenu/);
  assert.match(invoicePage, /openPaymentModal\(invoice\)/);
  assert.match(invoicePage, /paymentTarget \|\| postIssue\?\.invoice/);
  assert.match(invoicePage, /Payment recorded and allocated to the invoice/);
  assert.match(invoicePage, /setPaymentSaving\(false\)/);
  assert.doesNotMatch(invoicePage, /absolute right-3 top-11 z-10 w-48/);
  assert.match(paymentService, /netDocumentAllocations/);
  assert.match(paymentService, /toMinorUnits\(invoice\.grandTotal/);
  assert.doesNotMatch(paymentService, /invoice\.balanceDue[\s\S]{0,120}sumAmounts\(allocations\)/);
});

test("Real Estate handover UI hides inactive sales/workflow tabs and dead search copy", () => {
  const salesLifecycle = fs.readFileSync(path.join(__dirname, "../../frontend/src/features/dashboard/pages/SalesLifecyclePage.jsx"), "utf8");
  const workflow = fs.readFileSync(path.join(__dirname, "../../frontend/src/features/dashboard/pages/WorkflowPage.jsx"), "utf8");
  const navbar = fs.readFileSync(path.join(__dirname, "../../frontend/src/components/layout/Navbar.jsx"), "utf8");
  const styles = fs.readFileSync(path.join(__dirname, "../../frontend/src/index.css"), "utf8");

  assert.match(salesLifecycle, /visibleTabs/);
  assert.match(salesLifecycle, /shouldShowWorkspaceNavigation/);
  assert.match(salesLifecycle, /listCreditNotesRequest\(\) : Promise\.resolve\(\[\]\)/);
  assert.match(workflow, /visibleTabs/);
  assert.match(workflow, /Monthly Billing/);
  assert.match(workflow, /Site Visits/);
  assert.match(workflow, /allowedTabs/);
  assert.match(workflow, /shouldShowWorkspaceNavigation/);
  assert.doesNotMatch(navbar, /Search coming soon/);
  assert.match(styles, /\.no-scrollbar/);
});

test("quotation UI exposes real communication actions without pretending WhatsApp is configured", () => {
  const salesLifecycle = fs.readFileSync(path.join(__dirname, "../../frontend/src/features/dashboard/pages/SalesLifecyclePage.jsx"), "utf8");
  const api = fs.readFileSync(path.join(__dirname, "../../frontend/src/features/auth/api.js"), "utf8");

  assert.match(api, /sendQuoteCommunicationRequest/);
  assert.match(api, /\/communications\/quotes\/\$\{quoteId\}\/send/);
  assert.match(salesLifecycle, /Send email/);
  assert.match(salesLifecycle, /WhatsApp off/);
  assert.match(salesLifecycle, /Mark sent/);
});

test("monthly billing UI auto-fills selected service rate and explains generation behavior", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "../../frontend/src/features/dashboard/pages/WorkflowPage.jsx"), "utf8");

  assert.match(workflow, /selectedProduct/);
  assert.match(workflow, /product\?\.sellingPrice/);
  assert.match(workflow, /How Monthly Billing works/);
  assert.match(workflow, /Generate now creates the current invoice once/);
});

test("reports page surfaces GST and allocation-derived payment state in standard layout", () => {
  const reportsPage = fs.readFileSync(path.join(__dirname, "../../frontend/src/features/dashboard/pages/ReportsPage.jsx"), "utf8");
  const reportController = fs.readFileSync(path.join(__dirname, "../src/controllers/report.controller.js"), "utf8");

  assert.match(reportsPage, /Reports \/ GST/);
  assert.match(reportsPage, /Allocation-backed reports/);
  assert.match(reportsPage, /Total GST/);
  assert.match(reportsPage, /No pending invoice payments/);
  assert.match(reportController, /getDerivedInvoiceRows/);
  assert.match(reportController, /pendingPayment = derivedInvoices/);
});
