// Start Vite, then run with Playwright installed or BILLSTACK_PLAYWRIGHT_PATH set.
// Uses only intercepted fixture requests; no production/accounting data is changed.
const {chromium}=require(process.env.BILLSTACK_PLAYWRIGHT_PATH || "playwright");
const assert=require("node:assert/strict");
const base=process.env.BILLSTACK_QA_URL || "http://localhost:5173";
(async()=>{
 const browser=await chromium.launch({channel:"msedge",headless:true,args:["--disable-features=LocalNetworkAccessChecks"]});
 for(const mode of ["SELF_HOSTED","SAAS"]){
  const context=await browser.newContext({viewport:{width:1366,height:768}});
  let creates=0, allocationFail=true, paymentCalls=0, recurringListCalls=0;
  const recurringRows=[];
  const paymentKeys=[];
  const client={_id:"client",name:"Test Client",email:"test@example.com"};
  const product={_id:"service",name:"Office service",sellingPrice:10000,taxRate:18,status:"active"};
  const modules={deploymentMode:mode,businessProfile:{industryCode:"REAL_ESTATE"},catalog:["invoices","customers","quotations","expenses","products_services","recurring_billing","reports","communications","projects_tasks","credit_notes","sales_returns"].map(key=>({key,state:"ACTIVE"}))};
  const summary={metrics:{totalSales:0,paidAmount:0,unpaidAmount:0,totalInvoices:0,overdueInvoices:0,overdueAmount:0,paidExpenses:0,netOperatingDifference:0},recentInvoices:[],revenueChart:[],workflowMetrics:{recurringDueSoon:0}};
  const invoice={_id:"issued",customerId:client,invoiceNumber:"INV-2026-0001",grandTotal:11800,balanceDue:11800,invoiceDate:"2026-09-17",dueDate:"2026-09-17",status:"issued",paymentStatus:"unpaid",lineItems:[]};
  await context.addInitScript(({mode})=>localStorage.setItem("billstack-auth",JSON.stringify({accessToken:"fixture",user:{name:"QA",role:"owner"},business:{_id:"biz",id:"biz",name:"QA Workspace",deploymentMode:mode,onboardingCompleted:true,businessProfile:{industryCode:"REAL_ESTATE"},subscription:{isAccessible:true},gstConfiguration:{enabled:false},bankDetails:{}}})),{mode});
  await context.route("http://localhost:5000/api/**",async route=>{
   const url=new URL(route.request().url()),p=url.pathname,method=route.request().method();
   let data={};
   if(p.endsWith("/modules"))data=modules;
   else if(p.endsWith("/dashboard/summary"))data=summary;
   else if(p==="/api/customers")data={items:[client],pagination:{page:1,totalPages:1,total:1}};
   else if(p==="/api/products")data={items:[product],pagination:{page:1,totalPages:1,total:1}};
   else if(p==="/api/invoices"&&method==="POST"){creates++;data=invoice;}
   else if(p==="/api/invoices")data={items:creates?[invoice]:[],pagination:{page:1,totalPages:1,total:creates?1:0}};
   else if(p==="/api/invoices/issued")data=invoice;
   else if(p.endsWith("/allocations"))data=[];
   else if(p==="/api/payments"&&method==="POST"){paymentCalls++;paymentKeys.push(route.request().postDataJSON().idempotencyKey);data={_id:"payment",amount:4000};}
   else if(p.endsWith("/allocate")&&method==="POST"){
    if(allocationFail){allocationFail=false;return route.fulfill({status:400,json:{message:"Fixture allocation failure"}});}
    data={_id:"allocation"};invoice.balanceDue=7800;invoice.paymentStatus="partial";
   }
   else if(p.endsWith("/expenses/categories"))data=["Miscellaneous"];
   else if(p.endsWith("/expenses/summary"))data={totalExpenses:0,paid:0,unpaid:0,gstRecorded:0,byCategory:[]};
   else if(p==="/api/expenses")data={items:[],pagination:{page:1,totalPages:1,total:0}};
   else if(p==="/api/workflows/recurring"&&method==="POST") { const body=route.request().postDataJSON(); const row={_id:"recurring-1",...body,status:"DRAFT",grandTotal:10000,nextBillingDate:body.startDate,customerId:client}; recurringRows.unshift(row); data=row; }
   else if(p.endsWith("/status")&&p.includes("/api/workflows/recurring/")&&method==="POST") { const row=recurringRows.find(item=>p.includes(item._id)); row.status=route.request().postDataJSON().status; data=row; }
   else if(p.includes("/api/workflows/recurring/")&&method==="DELETE") { const index=recurringRows.findIndex(item=>p.includes(item._id)); const [removed]=recurringRows.splice(index,1); data={id:removed._id}; }
   else if(p==="/api/workflows/recurring") { recurringListCalls++; const snapshot=recurringRows.slice(); if(recurringListCalls===1) await new Promise(resolve=>setTimeout(resolve,700)); data=snapshot; }
   else if(p.endsWith("/reports/summary")){
    const size=Number(url.searchParams.get("pendingSize")||10),page=Number(url.searchParams.get("pendingPage")||1);
    data={monthlySales:[],collectionSummary:{totalSales:11800,paidAmount:4000,unpaidAmount:7800},customerWiseSales:[{_id:"client",customerName:"Test Client",totalSales:11800,paidAmount:4000,balanceDue:7800}],pendingPayment:Array.from({length:Math.min(size,3000-(page-1)*size)},(_,i)=>({_id:"pending-"+((page-1)*size+i),invoiceNumber:"INV-"+((page-1)*size+i),customerName:client.name,grandTotal:11800,balanceDue:7800,paymentStatus:"partial"})),pagination:{pending:{page,limit:size,total:3000,totalPages:Math.ceil(3000/size)},customers:{page:1,limit:10,total:1,totalPages:1}},productWiseSales:[],purchaseReport:[],taxReport:{},profitReport:{},expenseReport:{}};
   }
   else if(p.includes("gst"))data={sales:{},purchases:{},hsnSacSummary:{}};
   else if(p.includes("communications/summary"))data={providers:{}};
   else data=[];
   await route.fulfill({json:{data}});
  });
  await context.route(base+"/dashboard**",async route=>route.fulfill({response:await route.fetch({url:base+"/tests/action-workflows.html"})}));
  const page=await context.newPage(),errors=[];
  page.on("pageerror",err=>errors.push(err.message));
  for(const [label,selector,routeName] of [["Create invoice","#invoice-editor","invoices"],["Create quotation","#quote-editor","quotes"],[mode==="SELF_HOSTED"?"Add client":"Add customer","#customer-editor","customers"],["Record expense","#expense-editor","expenses"]]){
   await page.goto(base+"/dashboard");
   await page.locator(".dashboard-action").filter({hasText:label}).click();
   const form=page.locator(selector);await form.waitFor();
   await page.waitForFunction(()=>!new URLSearchParams(location.search).has("action"));
   await page.waitForFunction(selector=>{const form=document.querySelector(selector);return form?.contains(document.activeElement)},selector);
   if(routeName==="customers"||routeName==="expenses"){
    await form.getByRole("button",{name:"Cancel",exact:true}).click();
    assert.equal(await form.count(),0);
    await page.reload();assert.equal(await form.count(),0);
   }else if(routeName==="invoices"){
    await form.getByRole("button",{name:"Close",exact:true}).click();
    await page.reload();assert.equal(await form.count(),0);
   }else{
    await form.getByRole("button",{name:"Cancel",exact:true}).click();
    assert.equal(await form.locator("select").first().inputValue(),"");
   }
   // Direct URL enters the same real form; action intent is consumed.
   await page.goto(base+"/dashboard/"+routeName+"?action=create");
   await page.locator(selector).waitFor();
   await page.waitForFunction(()=>!new URLSearchParams(location.search).has("action"));
  }
  await page.goto(base+"/dashboard/invoices?action=create");
  const editor=page.locator("#invoice-editor");await editor.waitFor();
  await editor.locator('select[name="customerId"]').selectOption("client");
  await editor.getByPlaceholder("Type item or service").fill("Service");
  await editor.getByLabel("Rate",{exact:true}).fill("10000");
  await editor.getByLabel("GST %",{exact:true}).fill("18");
  await editor.getByLabel(/Payment at issue/).selectOption("partial");
  await editor.getByLabel("Received amount",{exact:true}).fill("4000");
  await editor.getByRole("button",{name:"Issue Invoice",exact:true}).click();
  await page.getByText(/Retry to complete payment without creating another invoice/).waitFor();
  await editor.getByRole("button",{name:"Issue Invoice",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector("#invoice-editor"));
  assert.equal(creates,1);assert.equal(paymentCalls,2); // same stable key, backend deduplicates
  assert.ok(paymentKeys[0]);assert.equal(paymentKeys[0],paymentKeys[1]);
  await page.locator("[data-invoice-menu-trigger]").click();
  await page.locator("[data-invoice-menu]").waitFor();
  assert.equal(await page.locator("[data-invoice-menu]").evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}),true);
  await page.getByRole("heading",{name:"All invoices",exact:true}).click();
  assert.equal(await page.locator("[data-invoice-menu]").count(),0);
  await page.locator("[data-invoice-menu-trigger]").click();
  await page.setViewportSize({width:1440,height:900});
  await page.waitForTimeout(150);
  assert.equal(await page.locator("[data-invoice-menu]").count(),0);
  await page.goto(base+"/dashboard/customers");
  await page.getByRole("button",{name:"Receive payment",exact:true}).click();
  await page.locator("#customer-payment-editor").waitFor();
  await page.locator("#customer-payment-editor").getByRole("button",{name:"Cancel",exact:true}).click();
  if(mode==="SELF_HOSTED"){
  recurringListCalls=0;
  await page.goto(base+"/dashboard/recurring-billing");
  await page.getByRole("heading",{name:/Monthly Billing|Recurring Billing/,exact:true}).first().waitFor();
  const recurringForm=page.locator('form').filter({has:page.getByRole("button",{name:"Save",exact:true})});
  await recurringForm.locator('select').first().selectOption("client");
  await recurringForm.locator('select').nth(1).selectOption("service");
  await recurringForm.getByLabel("Rate",{exact:true}).fill("10000");
  await recurringForm.getByRole("button",{name:"Save",exact:true}).click();
  await page.getByText("Test Client monthly billing",{exact:true}).waitFor();
  await page.waitForTimeout(900);
  assert.equal(await page.getByText("Test Client monthly billing",{exact:true}).count(),1,"saved monthly billing must survive stale list responses");
  const search=page.getByRole("textbox",{name:"Search Monthly Billing",exact:true});
  assert.equal(await search.evaluate(el=>parseFloat(getComputedStyle(el).paddingLeft)>=36),true,"search text must clear its icon");
  const recurringCard=page.getByText("Test Client monthly billing",{exact:true}).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
  await recurringCard.getByRole("button",{name:"Cancel",exact:true}).click();
  await page.getByText("Test Client monthly billing",{exact:true}).waitFor();
  await recurringCard.getByRole("button",{name:"Delete",exact:true}).click();
  const deleteDialog=page.getByRole("dialog",{name:"Delete monthly billing?"});
  await deleteDialog.getByRole("button",{name:"Delete",exact:true}).click();
  await page.getByText("No monthly billing yet",{exact:true}).waitFor();
  await page.reload();
  await page.getByText("No monthly billing yet",{exact:true}).waitFor();
  }
  for(const path of ["","invoices","customers","quotes","expenses","reports","recurring-billing","settings"]){
   await page.goto(base+"/dashboard/"+path);await page.waitForTimeout(400);
   if(path==="settings") {
    assert.equal(await page.getByText("Modules & Add-ons",{exact:true}).count(),mode==="SAAS"?1:0);
    assert.equal(await page.getByText("Indian GST configuration",{exact:true}).count(),0);
    for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[768,1024],[390,844]]) {
     await page.setViewportSize({width,height});
     for(const label of ["Business Profile","GST & Tax","Invoice & Payment","Branding","Communications"]) {
      await page.getByRole("navigation",{name:"Settings sections"}).getByRole("button",{name:label,exact:true}).click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${mode} settings ${label} ${width} overflow`);
     }
    }
    await page.setViewportSize({width:1366,height:768});
   }
   if(path==="quotes"&&mode==="SELF_HOSTED"){
    assert.equal(await page.locator('nav[aria-label="Sales sections"]').count(),0);
    assert.equal(await page.getByRole("button",{name:"Credit Notes",exact:true}).count(),0);
    assert.equal(await page.getByRole("button",{name:"Sales Returns",exact:true}).count(),0);
   }
   if(path==="reports"){
    const report=page.getByRole("region",{name:"Pending payments",exact:true});
    assert.equal(await report.locator("tbody tr").count(),5);
    await report.getByRole("button",{name:/View all pending payments/}).click();
    await page.waitForTimeout(250);
    assert.equal(await report.locator("tbody tr").count(),10);
    await report.getByRole("button",{name:"Next",exact:true}).click();
    await report.getByText("INV-10",{exact:true}).waitFor();
    await report.getByLabel("Pending payments rows per page").selectOption("25");
    await page.waitForTimeout(250);
    assert.equal(await report.locator("tbody tr").count(),25);
   }
   for(const [width,height] of [[1366,768],[1440,900],[1920,1080],[768,1024],[390,844]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(180);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,path+" overflow");
    if(path==="reports"){
     const navigation=page.getByRole("navigation",{name:"Report sections",exact:true});
     for(const button of await navigation.getByRole("button").all()){
      await button.click();await page.waitForTimeout(150);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,"report tab overflow at "+width);
      if(width>=768){
       const aligned=await page.locator(".reports-table").evaluateAll(tables=>tables.every(table=>[...table.querySelectorAll("tbody tr")].every(row=>[...row.children].every((cell,index)=>{
        const header=table.querySelectorAll("thead th")[index];
        return getComputedStyle(cell).textAlign===getComputedStyle(header).textAlign&&Math.abs(cell.getBoundingClientRect().left-header.getBoundingClientRect().left)<1&&Math.abs(cell.getBoundingClientRect().right-header.getBoundingClientRect().right)<1;
       }))));
       assert.equal(aligned,true,"Report headers and cells must share column edges and alignment at "+width);
      }
     }
     await navigation.getByRole("button",{name:"Overview",exact:true}).click();await page.waitForTimeout(150);
     if(width>=1366){const measurements=await page.getByRole("heading",{name:"Reports / GST",exact:true}).evaluate(el=>{const root=el.parentElement.parentElement;return {height:root.getBoundingClientRect().height,children:[...root.children].map(child=>({title:child.querySelector("h3")?.textContent,height:child.getBoundingClientRect().height,display:getComputedStyle(child).display,rows:[...child.querySelectorAll("tbody tr")].map(tr=>({height:tr.getBoundingClientRect().height,display:getComputedStyle(tr).display}))}))}});assert.ok(measurements.height<height*2,JSON.stringify(measurements));}
    }
   }
  }
  modules.catalog=modules.catalog.filter(item=>!["quotations","credit_notes","sales_returns"].includes(item.key));
  await page.goto(base+"/dashboard/quotes?action=create");
  await page.getByText("Sales actions are unavailable",{exact:true}).waitFor();
  assert.equal(await page.locator("#quote-editor").count(),0);
  assert.equal(errors.length,0,errors.join("\n"));
  console.log(mode+": actual forms, focus, consumed intent, cancel/refresh, issued-invoice retry and responsive major screens PASS");
  await context.close();
 }
 await browser.close();
})().catch(err=>{console.error(err);process.exit(1)});
