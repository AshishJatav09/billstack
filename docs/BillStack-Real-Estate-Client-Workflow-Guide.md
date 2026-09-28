# BillStack Real Estate + Co-working Client Workflow Guide

Prepared for: THE OFFICE ON RENT  
Deployment type: SELF_HOSTED client preview  
Workspace: Real Estate / Broker / Service business

## 1. Important payment rule

Invoice ko manually "Paid" mark nahi kiya jaata.

BillStack me invoice payment status backend automatically calculate karta hai:

- Payment record hua, lekin invoice par allocate nahi hua: invoice unpaid rahega.
- Payment ka kuch amount invoice par allocate hua: invoice partial rahega.
- Invoice ka full balance allocate ho gaya: invoice paid ho jayega.
- Payment reverse hua: invoice balance wapas outstanding ho sakta hai.

Isliye correct flow hai:

1. Invoice create/issue karo.
2. Payment receive/record karo.
3. Us payment ko correct invoice par allocate karo.
4. Dashboard, customer workspace, reports aur invoice status allocation ke basis par update honge.

## 2. Payment receive and allocate flow

Use this when customer has paid by cash, UPI, bank transfer or another offline method.

1. Open Customers / Clients.
2. Select the customer.
3. Click Receive payment.
4. Enter:
   - amount received
   - method
   - payment date
   - reference/UTR if available
   - notes if needed
5. After payment is recorded, allocate it to the eligible invoice.
6. If allocated amount equals invoice outstanding amount, invoice becomes Paid.

Important:

- BillStack validates customer, tenant, invoice, outstanding amount and available payment balance on the server.
- Do not create a second invoice or edit ledger manually for payment correction.
- If a wrong payment was recorded, use reversal/correction flow where available.

## 3. Why an invoice can still show unpaid after payment

Most common reasons:

- Payment was recorded but not allocated to the invoice.
- Allocation failed due to customer mismatch.
- Allocation amount was less than invoice outstanding amount.
- Browser is showing old cached frontend build.
- Server was not restarted after deployment.
- Dashboard/report screen is reading old data before refresh.

Quick check:

- Open the invoice detail page.
- Check payment/allocation history.
- If allocated amount is zero, invoice will remain unpaid.
- Allocate the payment to the invoice.

## 4. Client/customer workflow

1. Add customer/client.
2. Create quotation.
3. Review quotation amount, tax and customer details.
4. Download quotation PDF if required.
5. Send quotation by email if SMTP is configured.
6. Mark/transition quotation as accepted when client approves.
7. Convert accepted quotation to invoice.
8. Record payment when money is received.
9. Allocate payment to invoice.
10. Use customer statement/ledger for account history.

## 5. Quotation workflow

Quotations are for sending estimates/proposals before invoice creation.

Available actions:

- Create quote
- View quote
- Download quote PDF
- Send quote by email when SMTP is configured
- Convert accepted quote to invoice

WhatsApp is disabled in this preview, so WhatsApp send must not be treated as available.

## 6. Invoice workflow

Invoices are the authoritative billing documents.

Typical flow:

1. Create invoice with customer and service/item lines.
2. Server calculates invoice number, totals and GST.
3. Invoice becomes receivable after issue/create as per current flow.
4. Payment is recorded separately.
5. Payment allocation updates invoice payment status.

Do not treat invoice status as a manual toggle. Payment status comes from actual payment allocations.

## 7. Monthly billing / recurring billing

Monthly Billing is used for recurring co-working rent/service billing.

How it works:

1. Create a Monthly Billing profile.
2. Select customer/client.
3. Select product/service.
4. Enter quantity, rate and billing frequency.
5. Keep the profile active.
6. The reminder/recurring worker generates normal BillStack invoices when due.
7. Generate now can create a due invoice immediately where supported.

Important:

- Monthly Billing only creates invoices.
- It does not automatically charge the customer.
- Payment still has to be recorded and allocated after the customer pays.

## 8. Expense workflow

Expenses are for operating spend, separate from purchases/inventory.

Use Add expense and enter:

- vendor/payee
- category
- amount
- GST if applicable
- payment status
- paid amount/payment details where required

If payment status is Paid, paid amount must match the expense amount. Otherwise the backend rejects it to keep expense reporting accurate.

## 9. Reports and GST

Reports / GST shows business totals based on issued invoices, payment allocations and tax data.

Expected report behavior:

- Total sales: invoice totals
- Amount collected: allocated/recorded collections against invoices
- Receivables: outstanding invoice balance
- Pending payments: unpaid or partially paid invoices
- GST: taxable value and tax from invoice lines

If an amount was received but reports still show pending, confirm the payment was allocated to the invoice.

## 10. Communication configuration

For this preview:

- Email/SMTP: can be enabled after real SMTP credentials are available.
- WhatsApp: disabled.
- Google Login: disabled.
- Razorpay/BillStack SaaS billing: disabled.
- External Integration API: disabled.

Email sending requires real SMTP host, port, user, password and from address in the protected backend production environment file.

## 11. SELF_HOSTED navigation

The intended Real Estate + Co-working workspace should show:

- Dashboard
- Customers / Clients
- Quotations
- Invoices
- Expenses
- Reports / GST
- Communications
- Monthly Billing
- Settings

Modules not relevant to this client, such as inventory, purchases, suppliers, production, dispatch, HR, salary, marketplace and SaaS subscription upgrade, should not be shown as primary navigation.

## 12. Operator checklist

Daily use:

1. Add/update customers.
2. Create and send quotations.
3. Convert approved quotations to invoices.
4. Record received payments.
5. Allocate each payment to invoice.
6. Check dashboard receivables and pending payments.
7. Review reports/GST periodically.
8. Use monthly billing profiles for recurring rent/service invoices.

## 13. Troubleshooting

Invoice not becoming Paid:

- Check payment allocation.
- Check invoice outstanding amount.
- Check customer selected during payment.
- Refresh the page.

Quotation email not sending:

- SMTP may not be configured yet.
- WhatsApp is disabled in this preview.

Monthly billing invoice not generated:

- Check profile is Active.
- Check next billing date.
- Check worker service is running on server.

Reports not updating:

- Refresh page.
- Confirm payment allocation exists.
- Confirm latest frontend/backend build is deployed.

