const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const {pathToFileURL} = require("node:url");
const load = (name) => import(pathToFileURL(path.join(__dirname,"../../frontend/src/features",name)).href);
test("create intent is consumed once and preserves other query filters",async()=>{
 const {consumeCreateIntent,canLaunchCreate}=await load("workspace/createActionIntent.js");
 assert.equal(consumeCreateIntent("?action=create&search=abc"),"?search=abc");
 assert.equal(consumeCreateIntent("?action=create"),"");
 assert.equal(consumeCreateIntent(""),null);
 const modules={deploymentMode:"SELF_HOSTED",businessProfile:{industryCode:"REAL_ESTATE"},catalog:[{key:"projects_tasks",state:"ACTIVE"},{key:"invoices",state:"ACTIVE"}]};
 assert.equal(canLaunchCreate("invoices",modules,null,{role:"owner"}),true);
 assert.equal(canLaunchCreate("projects_tasks",modules,null,{role:"owner"}),false);
 assert.equal(canLaunchCreate("expenses",modules,null,{role:"owner"}),false);
 assert.equal(canLaunchCreate("invoices",modules,null,{role:"staff"},["owner"]),false);
});
test("SaaS commercial settings are preserved and every licensed workspace hides them",async()=>{
 const {shouldShowCommercialSettings}=await load("workspace/workspaceVisibility.js");
 assert.equal(shouldShowCommercialSettings(null,{deploymentMode:"SELF_HOSTED"}),false);
 assert.equal(shouldShowCommercialSettings({deploymentMode:"SELF_HOSTED",businessProfile:{industryCode:"TRADING"}}),false);
 assert.equal(shouldShowCommercialSettings({deploymentMode:"SAAS"}),true);
});
test("11800 invoice handles partial, retry after lost allocation response, final payment and overpayment",async()=>{
 const {recordInvoicePayment}=await load("dashboard/invoicePaymentWorkflow.js");
 let balance=11800, effects=0, lost=true;
 const payments=new Map(), allocations=[], recorded=new Map();
 const api={
  getInvoice:async()=>({_id:"inv",customerId:"client",balanceDue:balance}),
  listAllocations:async()=>allocations,
  createPayment:async fields=>{if(!payments.has(fields.idempotencyKey))payments.set(fields.idempotencyKey,{_id:fields.idempotencyKey});return payments.get(fields.idempotencyKey);},
  allocatePayment:async(id,payload)=>{effects++;balance-=payload.allocatedAmount;allocations.push({paymentId:id});if(lost){lost=false;throw new Error("Response lost");}},
 };
 const pay=async(amount,key)=>recordInvoicePayment({invoice:{_id:"inv"},amount,fields:{idempotencyKey:key},api,recordedPaymentId:recorded.get(key),onRecorded:id=>recorded.set(key,id)});
 await assert.rejects(pay(4000,"partial"),/Response lost/);
 assert.equal(balance,7800);
 assert.equal((await pay(4000,"partial")).alreadyApplied,true);
 assert.equal(effects,1);assert.equal(payments.size,1);
 await assert.rejects(pay(7801,"too-much"),/exceeds/);assert.equal(payments.size,1);
 await pay(7800,"final");assert.equal(balance,0);assert.equal(effects,2);
 await pay(7800,"final");assert.equal(effects,2);
});
test("quote estimate accepts a zero rate/tax and calculates the visible estimate",async()=>{
 const {estimatedQuoteTotal}=await load("dashboard/formPresentation.js");
 assert.equal(estimatedQuoteTotal({lineItems:[{quantity:1,rate:10000,taxRate:18}],shippingCharges:0}),11800);
 assert.equal(estimatedQuoteTotal({lineItems:[{quantity:1,rate:0,taxRate:0}]}),0);
});
test("shared actions, retry recovery, copy, modal errors and discoverable scrolling remain wired",()=>{
 const read=(name)=>fs.readFileSync(path.join(__dirname,"../../frontend/src",name),"utf8");
 const dashboard=read("features/dashboard/pages/DashboardHomePage.jsx");
 for(const route of ["invoices","quotes","customers","expenses"])assert.ok(dashboard.includes("/dashboard/"+route+"?action=create"));
 for(const page of ["InvoicesPage","CustomersPage","ExpensesPage","SalesLifecyclePage"])assert.match(read("features/dashboard/pages/"+page+".jsx"),/useCreateAction/);
 assert.match(read("features/dashboard/pages/InvoicesPage.jsx"),/pendingIssue.current \|\|/);
 assert.match(read("features/dashboard/pages/InvoicesPage.jsx"),/pendingIssue.current \? null : await buildInvoicePayload/);
 assert.match(read("features/dashboard/pages/InvoicesPage.jsx"),/issuePaymentDetails.current.amount, issuePaymentDetails.current.fields/);
 assert.match(read("features/dashboard/pages/InvoicesPage.jsx"),/event.target\?\.closest\?\./);
 assert.match(read("features/dashboard/pages/WorkflowPage.jsx"),/First billing date/);
 assert.match(read("features/dashboard/pages/CustomersPage.jsx"),/GSTIN/);
 const paymentModal=read("features/dashboard/pages/CustomersPage.jsx").split("const PaymentModal =")[1].split("const AllocationModal =")[0];
 assert.match(paymentModal,/id="customer-payment-editor"/);
 assert.doesNotMatch(paymentModal,/\{error\}/);
 assert.match(read("features/dashboard/pages/SalesLifecyclePage.jsx"),/if \(!visibleTabs.length\)/);
 assert.match(read("features/dashboard/pages/SalesLifecyclePage.jsx"),/visibleTabs.length > 1 \? <nav/);
 assert.doesNotMatch(read("features/dashboard/pages/SalesLifecyclePage.jsx"),/lg:row-span-3/);
 const reports=read("features/dashboard/pages/ReportsPage.jsx");
 assert.match(reports,/aria-label="Report sections"/);
 assert.match(reports,/table-fixed/);
 assert.doesNotMatch(reports,/Metric label="Sales GST"/);
 assert.doesNotMatch(read("components/layout/Navbar.jsx"),/aria-label="Notifications"/);
 assert.match(read("features/dashboard/pages/ReportsPage.jsx"),/From date must be on or before To date/);
 assert.match(read("features/dashboard/pages/ReportsPage.jsx"),/module: "purchases"/);
});
