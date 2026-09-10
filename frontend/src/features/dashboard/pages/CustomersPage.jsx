import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2, CircleAlert, Plus, Search, WalletCards, X } from "lucide-react";
import { EmptyState, LoadingState } from "../../../components/ui/PageState";
import { uiStore } from "../../../store/uiStore";
import {
  allocatePaymentRequest,
  communicationDeliveriesRequest,
  communicationScheduledRequest,
  createCustomerRequest,
  createPaymentRequest,
  customerLedgerRequest,
  customerStatementCsvRequest,
  customerStatementPdfRequest,
  customerStatementRequest,
  deleteCustomerRequest,
  listCustomersRequest,
  listInvoicesRequest,
  listPaymentsRequest,
  scheduleInvoiceReminderRequest,
  updateCustomerRequest,
} from "../../auth/api";

const blankCustomer = { name: "", phone: "", email: "", billingAddress: "", shippingAddress: "", gstNumber: "", notes: "" };
const blankPayment = () => ({ amount: "", paymentMethod: "UPI", paymentDate: new Date().toISOString().slice(0, 10), referenceNumber: "", notes: "" });
const methods = ["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "CARD", "OTHER"];
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
const date = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const matches = (value, id) => String(value?._id || value || "") === String(id || "");

const CustomersPage = () => {
  const [filters, setFilters] = useState({ page: 1, limit: 25, search: "", sortBy: "name", sortOrder: "asc" });
  const [result, setResult] = useState({ items: [], pagination: { page: 1, totalPages: 1 } });
  const [selectedId, setSelectedId] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [customerReminders, setCustomerReminders] = useState([]);
  const [customerDeliveries, setCustomerDeliveries] = useState([]);
  const [statement, setStatement] = useState(null);
  const [statementFilters, setStatementFilters] = useState({ from: "", to: "" });
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const [customerForm, setCustomerForm] = useState(blankCustomer);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState(blankPayment);
  const [paymentErrors, setPaymentErrors] = useState({});
  const [savingPayment, setSavingPayment] = useState(false);
  const [createdPayment, setCreatedPayment] = useState(null);
  const [invoiceId, setInvoiceId] = useState("");
  const [allocation, setAllocation] = useState("");
  const [allocating, setAllocating] = useState(false);

  const selected = result.items.find((customer) => customer._id === selectedId) || result.items[0];
  const customerInvoices = useMemo(() => invoices.filter((invoice) => matches(invoice.customerId, selected?._id)), [invoices, selected]);
  const customerPayments = useMemo(() => payments.filter((payment) => payment.direction === "RECEIVED" && matches(payment.customerId, selected?._id)), [payments, selected]);
  const metrics = useMemo(() => {
    const rows = customerInvoices.filter((row) => row.status !== "cancelled");
    return {
      outstanding: rows.reduce((sum, row) => sum + Number(row.balanceDue || 0), 0),
      overdue: rows.filter((row) => row.balanceDue > 0 && new Date(row.dueDate) < new Date()).reduce((sum, row) => sum + Number(row.balanceDue || 0), 0),
      invoiced: rows.reduce((sum, row) => sum + Number(row.grandTotal || 0), 0),
      collected: rows.reduce((sum, row) => sum + Number(row.amountPaid || 0), 0),
    };
  }, [customerInvoices]);
  const allocated = Number(createdPayment?.allocated || 0);
  const remaining = Math.max(Number(createdPayment?.amount || 0) - allocated, 0);

  const loadCustomers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listCustomersRequest(filters);
      setResult(data);
      setSelectedId((current) => current || data.items?.[0]?._id || "");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load customers.");
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async () => {
    if (!selected?._id) return;
    setLoadingDetail(true);
    try {
      const [invoiceData, paymentData, ledgerData, reminderData, deliveryData] = await Promise.all([
        listInvoicesRequest({ page: 1, limit: 100, sortBy: "invoiceDate", sortOrder: "desc" }),
        listPaymentsRequest({ limit: 100 }),
        customerLedgerRequest(selected._id),
        communicationScheduledRequest({ customerId: selected._id }),
        communicationDeliveriesRequest({ customerId: selected._id }),
      ]);
      setInvoices(invoiceData.items || []);
      setPayments(paymentData || []);
      setLedger(ledgerData || []);
      setCustomerReminders(reminderData || []);
      setCustomerDeliveries(deliveryData || []);
    } catch (err) {
      setError(err.response?.data?.message || "Some financial activity could not be loaded.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadStatement = async () => {
    if (!selected?._id) return;
    setLoadingStatement(true);
    try {
      setStatement(await customerStatementRequest(selected._id, { ...statementFilters, limit: 300 }));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load customer statement.");
    } finally {
      setLoadingStatement(false);
    }
  };

  useEffect(() => { loadCustomers(); }, [filters.page, filters.search, filters.sortBy, filters.sortOrder]);
  useEffect(() => { loadDetail(); }, [selected?._id]);
  useEffect(() => { if (tab === "statement") loadStatement(); }, [tab, selected?._id]);

  const changeFilter = (event) => setFilters((current) => ({ ...current, page: 1, [event.target.name]: event.target.value }));
  const saveCustomer = async (event) => { event.preventDefault(); setSavingCustomer(true); try { if (editor === "edit") await updateCustomerRequest(selected._id, customerForm); else await createCustomerRequest(customerForm); uiStore.getState().pushToast({ tone: "success", message: editor === "edit" ? "Customer updated successfully." : "Customer created successfully." }); setEditor(null); await loadCustomers(); } catch (err) { setError(err.response?.data?.message || "Unable to save customer."); } finally { setSavingCustomer(false); } };
  const deleteCustomer = async () => { if (!selected || !window.confirm(`Delete ${selected.name}? This cannot be undone.`)) return; try { await deleteCustomerRequest(selected._id); uiStore.getState().pushToast({ tone: "success", message: "Customer deleted successfully." }); setSelectedId(""); await loadCustomers(); } catch (err) { setError(err.response?.data?.message || "Unable to delete customer."); } };
  const recordPayment = async (event) => { event.preventDefault(); const next = {}; const amount = Number(paymentForm.amount); if (!Number.isFinite(amount) || amount <= 0) next.amount = "Enter an amount greater than zero."; if (!paymentForm.paymentDate) next.paymentDate = "Payment date is required."; setPaymentErrors(next); if (Object.keys(next).length) return; setSavingPayment(true); try { const payment = await createPaymentRequest({ ...paymentForm, amount, direction: "RECEIVED", customerId: selected._id, currency: "INR" }); setCreatedPayment({ ...payment, allocated: 0 }); setPaymentOpen(false); setPayments((current) => [payment, ...current]); uiStore.getState().pushToast({ tone: "success", message: "Payment recorded. Allocate it to an invoice to update derived payment state." }); } catch (err) { setPaymentErrors({ form: err.response?.data?.message || "Unable to record payment." }); } finally { setSavingPayment(false); } };
  const allocatePayment = async (event) => { event.preventDefault(); const amount = Number(allocation); if (!invoiceId || !Number.isFinite(amount) || amount <= 0) return setPaymentErrors({ allocation: "Choose an invoice and enter a positive allocation amount." }); setAllocating(true); setPaymentErrors({}); try { await allocatePaymentRequest(createdPayment._id, { invoiceId, allocatedAmount: amount }); setCreatedPayment((current) => ({ ...current, allocated: Number(current.allocated || 0) + amount })); setInvoiceId(""); setAllocation(""); uiStore.getState().pushToast({ tone: "success", message: "Payment allocation recorded and reflected in derived payment reads." }); await loadDetail(); } catch (err) { setPaymentErrors({ allocation: err.response?.data?.message || "Unable to allocate payment." }); } finally { setAllocating(false); } };
  const scheduleCustomerReminder = async () => { const invoice = customerInvoices.find((row) => row.status !== "cancelled" && Number(row.balanceDue || 0) > 0); if (!invoice) return uiStore.getState().pushToast({ tone: "info", message: "No outstanding invoice is available for reminders." }); const defaultWhen = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16); const value = window.prompt("Schedule email reminder date/time", defaultWhen); if (!value) return; try { await scheduleInvoiceReminderRequest(invoice._id, { channel: "EMAIL", scheduledFor: new Date(value).toISOString() }); uiStore.getState().pushToast({ tone: "success", message: `Reminder scheduled for ${invoice.invoiceNumber}.` }); await loadDetail(); } catch (err) { setError(err.response?.data?.message || "Unable to schedule reminder."); } };
  const downloadStatement = async (type) => { if (!selected?._id) return; const blob = type === "pdf" ? await customerStatementPdfRequest(selected._id, statementFilters) : await customerStatementCsvRequest(selected._id, statementFilters); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `customer-statement-${selected.name}.${type}`; anchor.click(); URL.revokeObjectURL(url); };

  return <div className="mx-auto max-w-[1600px] space-y-6 pb-8">
    <section className="rounded-2xl border p-5 sm:p-7" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-medium text-brand-600 dark:text-brand-300">Customer workspace</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Customers</h2><p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Manage customers, payments, reminders, and account statements.</p></div><button onClick={() => { setCustomerForm(blankCustomer); setEditor("new"); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white"><Plus size={17} /> Add customer</button></div></section>
    {error ? <div className="flex justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-200"><span className="flex gap-2"><CircleAlert size={18} />{error}</span><button onClick={() => setError("")}><X size={16} /></button></div> : null}
    <div className="grid gap-6"><aside className="rounded-2xl border" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><div className="border-b p-3" style={{ borderColor: "var(--panel-border)" }}><label className="relative block"><Search size={16} className="absolute left-3 top-3" style={{ color: "var(--text-muted)" }} /><input name="search" value={filters.search} onChange={changeFilter} placeholder="Search customers" className="w-full rounded-xl border bg-transparent py-2.5 pl-9 pr-3 text-sm" style={{ borderColor: "var(--panel-border)" }} /></label></div>{loading ? <div className="p-4"><LoadingState title="Loading customers" description="Fetching customer records." /></div> : result.items.length ? <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">{result.items.map((customer) => <button key={customer._id} onClick={() => { setSelectedId(customer._id); setTab("overview"); }} className="w-full rounded-xl border px-4 py-3 text-left transition hover:bg-slate-500/[.04]" style={{ borderColor: "var(--panel-border)", background: selected?._id === customer._id ? "color-mix(in srgb, var(--accent) 7%, transparent)" : "transparent" }}><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{customer.name}</p><p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-muted)" }}>{customer.email || customer.phone || "No contact details"}</p></div><span className="shrink-0 text-lg leading-none text-brand-600">�</span></div></button>)}</div> : <div className="p-4"><EmptyState title="No customers found" description="Create a customer to start billing." /></div>}</aside>
      <main className="min-w-0 space-y-6">{selected ? <><section className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between"><div><p className="text-sm font-medium text-brand-600">Customer details</p><h3 className="mt-1 text-2xl font-semibold">{selected.name}</h3><p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{[selected.email, selected.phone].filter(Boolean).join(" · ") || "No contact details recorded"}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => { setPaymentForm(blankPayment()); setPaymentErrors({}); setPaymentOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"><WalletCards size={16} /> Receive payment</button><button onClick={() => { setCustomerForm({ ...blankCustomer, ...selected }); setEditor("edit"); }} className="rounded-xl border px-4 py-2.5 text-sm" style={{ borderColor: "var(--panel-border)" }}>Edit customer</button><button onClick={deleteCustomer} className="rounded-xl border border-rose-500/30 px-4 py-2.5 text-sm text-rose-600">Delete</button></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Outstanding", metrics.outstanding], ["Overdue", metrics.overdue], ["Total invoiced", metrics.invoiced], ["Total collected", metrics.collected]].map(([label, value]) => <div key={label} className="rounded-xl border p-4" style={{ borderColor: "var(--panel-border)" }}><p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p><p className="mt-2 text-xl font-semibold">{money(value)}</p></div>)}</div></section>
        <nav className="flex flex-wrap gap-1 rounded-xl border p-1" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>{["overview", "invoices", "payments", "ledger", "statement", "communications"].map((item) => <button key={item} onClick={() => setTab(item)} className="whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium capitalize" style={tab === item ? { background: "var(--accent)", color: "white" } : { color: "var(--text-muted)" }}>{item}</button>)}</nav>
        {loadingDetail ? <LoadingState title="Loading financial activity" description="Fetching invoices, payments, and ledger entries." /> : <section className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>{tab === "overview" ? <div className="grid gap-6 xl:grid-cols-2"><div><h4 className="font-semibold">Contact information</h4><dl className="mt-4 grid gap-3 text-sm"><div><dt style={{ color: "var(--text-muted)" }}>Billing address</dt><dd className="mt-1">{selected.billingAddress || "Not recorded"}</dd></div><div><dt style={{ color: "var(--text-muted)" }}>GST number</dt><dd className="mt-1">{selected.gstNumber || "Not recorded"}</dd></div><div><dt style={{ color: "var(--text-muted)" }}>Notes</dt><dd className="mt-1">{selected.notes || "No notes"}</dd></div></dl></div><Activity rows={ledger.slice(0, 6)} /></div> : null}{tab === "invoices" ? <InvoiceTable rows={customerInvoices} /> : null}{tab === "payments" ? <PaymentTable rows={customerPayments} /> : null}{tab === "ledger" ? <LedgerTable rows={ledger} /> : null}{tab === "statement" ? <StatementPanel statement={statement} filters={statementFilters} setFilters={setStatementFilters} loading={loadingStatement} onApply={loadStatement} onDownload={downloadStatement} /> : null}{tab === "communications" ? <CustomerCommunications reminders={customerReminders} deliveries={customerDeliveries} onSchedule={scheduleCustomerReminder} /> : null}</section>}</> : <EmptyState title="Select a customer" description="Choose a customer to open their financial workspace." />}</main></div>
    {editor ? <CustomerModal form={customerForm} setForm={setCustomerForm} mode={editor} saving={savingCustomer} onSave={saveCustomer} onClose={() => setEditor(null)} /> : null}
    {paymentOpen ? <PaymentModal form={paymentForm} setForm={setPaymentForm} errors={paymentErrors} saving={savingPayment} customer={selected} onSave={recordPayment} onClose={() => setPaymentOpen(false)} /> : null}
    {createdPayment ? <AllocationModal payment={createdPayment} allocated={allocated} remaining={remaining} invoices={customerInvoices} invoiceId={invoiceId} setInvoiceId={setInvoiceId} allocation={allocation} setAllocation={setAllocation} errors={paymentErrors} allocating={allocating} onSave={allocatePayment} onClose={() => setCreatedPayment(null)} /> : null}
  </div>;
};

const Field = ({ label, error, children }) => <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}{error ? <span className="mt-1 block text-xs text-rose-600">{error}</span> : null}</label>;
const CustomerModal = ({ form, setForm, mode, saving, onSave, onClose }) => <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-4"><form onSubmit={onSave} className="mx-auto my-5 w-full max-w-2xl rounded-2xl border p-6 shadow-2xl" style={{ borderColor: "var(--panel-border)", background: "var(--theme-surface-strong)" }}><div className="flex justify-between"><div><p className="text-sm font-medium text-brand-600">Customer details</p><h3 className="mt-1 text-xl font-semibold">{mode === "edit" ? "Edit customer" : "Add customer"}</h3></div><button type="button" onClick={onClose}><X size={20} /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2">{[["name", "Name"], ["email", "Email"], ["phone", "Phone"], ["gstNumber", "GST number"], ["billingAddress", "Billing address"], ["shippingAddress", "Shipping address"]].map(([key, label]) => <Field key={key} label={label}><input required={key === "name"} value={form[key] || ""} onChange={(event) => setForm((v) => ({ ...v, [key]: event.target.value }))} className="field" /></Field>)}</div><Field label="Notes"><textarea rows="3" value={form.notes || ""} onChange={(event) => setForm((v) => ({ ...v, notes: event.target.value }))} className="field" /></Field><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm" style={{ borderColor: "var(--panel-border)" }}>Cancel</button><button disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save customer"}</button></div></form></div>;
const PaymentModal = ({ form, setForm, errors, saving, customer, onSave, onClose }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"><form onSubmit={onSave} className="w-full max-w-xl rounded-2xl border p-6 shadow-2xl" style={{ borderColor: "var(--panel-border)", background: "var(--theme-surface-strong)" }}><div className="flex justify-between"><div><p className="text-sm font-medium text-brand-600">Receive payment</p><h3 className="mt-1 text-xl font-semibold">Record a customer payment</h3><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{customer.name}</p></div><button type="button" onClick={onClose}><X size={20} /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Amount" error={errors.amount}><input value={form.amount} onChange={(event) => setForm((v) => ({ ...v, amount: event.target.value }))} inputMode="decimal" placeholder="0.00" className="field" /></Field><Field label="Payment date" error={errors.paymentDate}><input type="date" value={form.paymentDate} onChange={(event) => setForm((v) => ({ ...v, paymentDate: event.target.value }))} className="field" /></Field><Field label="Payment method"><select value={form.paymentMethod} onChange={(event) => setForm((v) => ({ ...v, paymentMethod: event.target.value }))} className="field">{methods.map((method) => <option key={method}>{method}</option>)}</select></Field><Field label="Reference number"><input value={form.referenceNumber} onChange={(event) => setForm((v) => ({ ...v, referenceNumber: event.target.value }))} className="field" /></Field></div><Field label="Notes"><textarea rows="3" value={form.notes} onChange={(event) => setForm((v) => ({ ...v, notes: event.target.value }))} className="field" /></Field>{errors.form ? <p className="mt-3 text-sm text-rose-600">{errors.form}</p> : null}<p className="mt-4 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">This records a new payment event. Allocate it to an invoice to update derived invoice payment state.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm" style={{ borderColor: "var(--panel-border)" }}>Cancel</button><button disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Recording..." : "Record payment"}</button></div></form></div>;
const AllocationModal = ({ payment, allocated, remaining, invoices, invoiceId, setInvoiceId, allocation, setAllocation, errors, allocating, onSave, onClose }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"><div className="w-full max-w-xl rounded-2xl border p-6 shadow-2xl" style={{ borderColor: "var(--panel-border)", background: "var(--theme-surface-strong)" }}><div className="flex justify-between"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 text-emerald-500" /><div><h3 className="text-xl font-semibold">Payment recorded</h3><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Allocate it to an eligible invoice when ready.</p></div></div><button onClick={onClose}><X size={20} /></button></div><div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-slate-500/[.06] p-4 text-sm"><div><p style={{ color: "var(--text-muted)" }}>Payment</p><strong>{money(payment.amount)}</strong></div><div><p style={{ color: "var(--text-muted)" }}>Allocated</p><strong>{money(allocated)}</strong></div><div><p style={{ color: "var(--text-muted)" }}>Remaining</p><strong>{money(remaining)}</strong></div></div><form onSubmit={onSave} className="mt-5"><h4 className="font-semibold">Allocate to invoice</h4><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]"><select value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} className="field"><option value="">Select eligible invoice</option>{invoices.filter((invoice) => invoice.status !== "cancelled" && Number(invoice.balanceDue) > 0).map((invoice) => <option key={invoice._id} value={invoice._id}>{invoice.invoiceNumber} · Outstanding {money(invoice.balanceDue)}</option>)}</select><input value={allocation} onChange={(event) => setAllocation(event.target.value)} inputMode="decimal" placeholder="Amount" className="field" /></div>{errors.allocation ? <p className="mt-2 text-sm text-rose-600">{errors.allocation}</p> : null}<p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>BillStack validates payment availability, invoice outstanding, tenant, and customer ownership on submission.</p><div className="mt-5 flex justify-end gap-3"><button onClick={onClose} type="button" className="rounded-xl border px-4 py-2.5 text-sm" style={{ borderColor: "var(--panel-border)" }}>Done</button><button disabled={allocating || remaining <= 0} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{allocating ? "Allocating..." : "Allocate payment"}</button></div></form></div></div>;
const Table = ({ headers, rows, empty }) => <div className="overflow-x-auto no-scrollbar"><table className="min-w-[640px] w-full text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide" style={{ borderColor: "var(--panel-border)", color: "var(--text-muted)" }}><tr>{headers.map((header) => <th key={header} className="p-3 font-medium">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b" style={{ borderColor: "var(--panel-border)" }}>{row.map((cell, cellIndex) => <td key={cellIndex} className="p-3 capitalize">{cell || "—"}</td>)}</tr>)}</tbody></table>{!rows.length ? <EmptyState title={empty} description="Activity will appear here when it is available." /> : null}</div>;
const InvoiceTable = ({ rows }) => <Table headers={["Invoice", "Issue date", "Due date", "Amount", "Payment state"]} rows={rows.map((row) => [row.invoiceNumber, date(row.invoiceDate), date(row.dueDate), money(row.grandTotal), row.paymentStatus])} empty="No invoices for this customer." />;
const PaymentTable = ({ rows }) => <Table headers={["Payment ID / reference", "Date", "Amount", "Method", "Status"]} rows={rows.map((row) => [row.referenceNumber || row._id.slice(-8), date(row.paymentDate), money(row.amount), row.paymentMethod, row.status])} empty="No recorded payments for this customer." />;
const LedgerTable = ({ rows }) => <Table headers={["Date", "Description", "Reference", "Debit / credit", "Amount"]} rows={rows.map((row) => [date(row.createdAt), row.eventType === "PAYMENT" ? "Payment recorded" : row.eventType, row.referenceNumber || row.paymentId?.referenceNumber || row.invoiceId?.invoiceNumber || "—", row.direction, money(row.amount)])} empty="No financial activity has been recorded yet." />;
const StatementPanel = ({ statement, filters, setFilters, loading, onApply, onDownload }) => <div className="space-y-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h4 className="font-semibold">Customer Statement</h4><p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Authoritative account statement from immutable customer ledger events.</p></div><div className="flex flex-wrap gap-2"><input type="date" value={filters.from} onChange={(e) => setFilters((v) => ({ ...v, from: e.target.value }))} className="field w-auto" /><input type="date" value={filters.to} onChange={(e) => setFilters((v) => ({ ...v, to: e.target.value }))} className="field w-auto" /><button onClick={onApply} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white">Apply</button><button onClick={() => window.print()} className="rounded-xl border px-4 py-2.5 text-sm" style={{ borderColor: "var(--panel-border)" }}>Print</button><button onClick={() => onDownload("pdf")} className="rounded-xl border px-4 py-2.5 text-sm" style={{ borderColor: "var(--panel-border)" }}>PDF</button><button onClick={() => onDownload("csv")} className="rounded-xl border px-4 py-2.5 text-sm" style={{ borderColor: "var(--panel-border)" }}>CSV</button></div></div>{loading ? <LoadingState title="Loading statement" description="Calculating opening balance and running balance." /> : statement ? <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Opening", statement.openingBalance], ["Debit", statement.totalDebit], ["Credit", statement.totalCredit], ["Closing", statement.closingBalance]].map(([label, value]) => <div key={label} className="rounded-xl border p-4" style={{ borderColor: "var(--panel-border)" }}><p className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p><p className="mt-2 text-xl font-semibold">{money(value)}</p></div>)}</div><Table headers={["Date", "Particulars", "Reference", "Debit", "Credit", "Balance"]} rows={(statement.transactions || []).map((row) => [date(row.date), row.type.replaceAll("_", " "), row.reference || "—", row.debit ? money(row.debit) : "", row.credit ? money(row.credit) : "", money(row.runningBalance)])} empty="No statement transactions for this period." /></> : <EmptyState title="No statement loaded" description="Choose a period and apply filters." />}</div>;
const CustomerCommunications = ({ reminders, deliveries, onSchedule }) => <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h4 className="font-semibold">Reminder and message history</h4><p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Track scheduled payment reminders and delivery outcomes for this customer.</p></div><button onClick={onSchedule} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"><BellRing size={16} /> Schedule reminder</button></div><div className="grid gap-5 xl:grid-cols-2"><div><p className="text-sm font-semibold">Upcoming reminders</p><Table headers={["Invoice", "Channel", "When", "Status"]} rows={reminders.map((row) => [row.invoiceId?.invoiceNumber || "—", row.channel, row.scheduledFor ? new Date(row.scheduledFor).toLocaleString("en-IN") : "—", row.status])} empty="No reminders scheduled for this customer." /></div><div><p className="text-sm font-semibold">Message history</p><Table headers={["Invoice", "Channel", "Status", "Sent / updated"]} rows={deliveries.map((row) => [row.invoiceId?.invoiceNumber || "—", row.channel, row.status, date(row.sentAt || row.updatedAt || row.createdAt)])} empty="No communication history for this customer." /></div></div></div>;
const Activity = ({ rows }) => <div><h4 className="font-semibold">Financial activity</h4>{rows.length ? <div className="mt-4 space-y-3">{rows.map((row) => <div key={row._id} className="flex items-center justify-between border-b pb-3 text-sm" style={{ borderColor: "var(--panel-border)" }}><div><p className="font-medium">{row.eventType === "PAYMENT" ? "Payment recorded" : row.eventType}</p><p className="text-xs" style={{ color: "var(--text-muted)" }}>{date(row.createdAt)}</p></div><strong className={row.direction === "CREDIT" ? "text-emerald-600" : "text-rose-600"}>{row.direction === "CREDIT" ? "+" : "−"}{money(row.amount)}</strong></div>)}</div> : <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>No financial activity recorded.</p>}</div>;

export default CustomersPage;
