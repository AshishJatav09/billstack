import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, FileText, RefreshCw, RotateCcw, Send, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { EmptyState, LoadingState } from "../../../components/ui/PageState";
import { uiStore } from "../../../store/uiStore";
import {
  convertQuoteRequest,
  createCreditNoteRequest,
  createQuoteRequest,
  createSalesReturnRequest,
  getQuoteRequest,
  listCreditNotesRequest,
  listCustomersRequest,
  listInvoicesRequest,
  listProductsRequest,
  listQuotesRequest,
  listSalesReturnsRequest,
  updateQuoteRequest,
  updateQuoteStatusRequest,
} from "../../auth/api";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
const date = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const sourceKey = (prefix, payload) => `${prefix}:${encodeURIComponent(JSON.stringify(payload))}`;
const statusClass = (status) => ["ACCEPTED", "CONVERTED", "ISSUED"].includes(status) ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : ["REJECTED", "EXPIRED", "CANCELLED"].includes(status) ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : status === "SENT" ? "bg-brand-500/10 text-brand-700 dark:text-brand-200" : "bg-slate-500/10 text-slate-700 dark:text-slate-200";

const blankQuoteLine = () => ({ productId: "", quantity: 1, rate: "", taxRate: "", discountValue: 0, discountType: "percent" });
const blankQuoteForm = () => ({ customerId: "", lineItems: [blankQuoteLine()], shippingCharges: 0, roundOff: 0 });
const blankCreditForm = () => ({ invoiceId: "", lineItems: [] });
const blankReturnForm = () => ({ invoiceId: "", lineItems: [] });

const SalesLifecyclePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialTab = location.pathname.includes("credit-notes") ? "creditNotes" : location.pathname.includes("sales-returns") ? "returns" : "quotes";
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [creditNotes, setCreditNotes] = useState([]);
  const [returns, setReturns] = useState([]);
  const [quoteForm, setQuoteForm] = useState(blankQuoteForm);
  const [editingQuote, setEditingQuote] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [creditForm, setCreditForm] = useState(blankCreditForm);
  const [returnForm, setReturnForm] = useState(blankReturnForm);
  const [saving, setSaving] = useState("");
  const pendingActionRef = useRef("");

  const beginAction = (key) => {
    if (pendingActionRef.current) return false;
    pendingActionRef.current = key;
    setSaving(key);
    return true;
  };

  const endAction = () => {
    pendingActionRef.current = "";
    setSaving("");
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [customerData, productData, invoiceData, quoteData, creditData, returnData] = await Promise.all([
        listCustomersRequest({ page: 1, limit: 250 }),
        listProductsRequest({ page: 1, limit: 250 }),
        listInvoicesRequest({ page: 1, limit: 250, sortBy: "invoiceDate", sortOrder: "desc" }),
        listQuotesRequest(),
        listCreditNotesRequest(),
        listSalesReturnsRequest(),
      ]);
      setCustomers(customerData.items || []);
      setProducts(productData.items || []);
      setInvoices(invoiceData.items || []);
      setQuotes(quoteData || []);
      setCreditNotes(creditData || []);
      setReturns(returnData || []);
    } catch (loadError) {
      setError(loadError.response?.data?.message || "Unable to load sales lifecycle workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  const openTab = (next) => {
    setTab(next);
    navigate(next === "creditNotes" ? "/dashboard/credit-notes" : next === "returns" ? "/dashboard/sales-returns" : "/dashboard/quotes", { replace: true });
  };

  const productMap = useMemo(() => new Map(products.map((product) => [String(product._id), product])), [products]);
  const selectedCreditInvoice = invoices.find((invoice) => invoice._id === creditForm.invoiceId);
  const selectedReturnInvoice = invoices.find((invoice) => invoice._id === returnForm.invoiceId);
  const creditUsage = useMemo(() => usageByInvoiceLine(creditNotes, creditForm.invoiceId, "amount"), [creditNotes, creditForm.invoiceId]);
  const returnUsage = useMemo(() => usageByInvoiceLine(returns, returnForm.invoiceId, "quantity"), [returns, returnForm.invoiceId]);

  const saveQuote = async (event) => {
    event.preventDefault();
    if (!beginAction("quote")) return;
    try {
      const payload = normalizeQuotePayload(quoteForm, productMap);
      const row = editingQuote ? await updateQuoteRequest(editingQuote._id, payload) : await createQuoteRequest(payload);
      uiStore.getState().pushToast({ tone: "success", message: editingQuote ? "Draft quote updated." : "Quote created." });
      setEditingQuote(null);
      setQuoteForm(blankQuoteForm());
      setSelectedQuote(row);
      await load();
    } catch (saveError) {
      setError(saveError.response?.data?.message || "Unable to save quote.");
    } finally {
      endAction();
    }
  };

  const transitionQuote = async (quote, status) => {
    if (!beginAction(`${quote._id}-${status}`)) return;
    try {
      const row = await updateQuoteStatusRequest(quote._id, status);
      setSelectedQuote(row);
      uiStore.getState().pushToast({ tone: "success", message: `Quote marked ${status.toLowerCase()}.` });
      await load();
    } catch (transitionError) {
      setError(transitionError.response?.data?.message || "Unable to update quote status.");
    } finally {
      endAction();
    }
  };

  const convertQuote = async (quote) => {
    if (!beginAction(`${quote._id}-convert`)) return;
    try {
      const invoice = await convertQuoteRequest(quote._id);
      uiStore.getState().pushToast({ tone: "success", message: "Quote converted to invoice." });
      navigate(`/dashboard/invoices/${invoice._id}`);
    } catch (convertError) {
      setError(convertError.response?.data?.message || "Unable to convert quote.");
    } finally {
      endAction();
    }
  };

  const editQuote = async (quote) => {
    try {
      const detail = await getQuoteRequest(quote._id);
      setEditingQuote(detail);
      setQuoteForm({
        customerId: detail.customerId?._id || detail.customerId,
        lineItems: detail.lineItems?.map((line) => ({ productId: line.productId?._id || line.productId, quantity: line.quantity, rate: line.rate, taxRate: line.taxRate, discountValue: line.discountValue || 0, discountType: line.discountType || "percent" })) || [blankQuoteLine()],
        shippingCharges: detail.shippingCharges || 0,
        roundOff: detail.roundOff || 0,
      });
    } catch (detailError) {
      setError(detailError.response?.data?.message || "Unable to open quote.");
    }
  };

  const submitCreditNote = async (event) => {
    event.preventDefault();
    if (!beginAction("credit")) return;
    try {
      const payload = { ...creditForm, lineItems: creditForm.lineItems.filter((line) => Number(line.quantity) > 0 || Number(line.amount) > 0), sourceKey: sourceKey("CREDIT_NOTE_UI", creditForm) };
      const row = await createCreditNoteRequest(payload);
      uiStore.getState().pushToast({ tone: "success", message: "Credit note issued." });
      setCreditForm(blankCreditForm());
      await load();
      setTab("creditNotes");
      setError("");
      setTimeout(() => setSelectedQuote(row), 0);
    } catch (creditError) {
      setError(creditError.response?.data?.message || "Unable to issue credit note.");
    } finally {
      endAction();
    }
  };

  const submitReturn = async (event) => {
    event.preventDefault();
    if (!beginAction("return")) return;
    try {
      const payload = { ...returnForm, lineItems: returnForm.lineItems.filter((line) => Number(line.quantity) > 0), sourceKey: sourceKey("SALES_RETURN_UI", returnForm) };
      await createSalesReturnRequest(payload);
      uiStore.getState().pushToast({ tone: "success", message: "Sales return issued and inventory restored." });
      setReturnForm(blankReturnForm());
      await load();
      setTab("returns");
      setError("");
    } catch (returnError) {
      setError(returnError.response?.data?.message || "Unable to issue sales return.");
    } finally {
      endAction();
    }
  };

  if (loading) return <LoadingState title="Loading sales lifecycle" description="Fetching quotes, credit notes, returns, invoices, and products." />;

  return <div className="mx-auto max-w-[1500px] space-y-6 pb-8">
    <section className="flex flex-col gap-4 rounded-2xl border p-5 sm:p-7 xl:flex-row xl:items-end xl:justify-between" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
      <div><p className="text-sm font-medium text-brand-600">Sales lifecycle</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Quotes, credit notes and sales returns</h2><p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--text-muted)" }}>Create quotes, convert accepted quotes to invoices, issue customer credits, and process sales returns without mutating historical invoice/payment records.</p></div>
      <button type="button" onClick={load} disabled={loading || Boolean(saving)} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-60" style={{ borderColor: "var(--panel-border)" }}><RefreshCw size={16} /> Refresh</button>
    </section>
    {error ? <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-200"><span className="flex gap-2"><CircleAlert size={18} />{error}</span><button onClick={() => setError("")}><X size={16} /></button></div> : null}
    <nav className="flex overflow-x-auto rounded-xl border p-1" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>{[["quotes", "Quotations"], ["creditNotes", "Credit Notes"], ["returns", "Sales Returns"]].map(([key, label]) => <button key={key} onClick={() => openTab(key)} className="whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium" style={tab === key ? { background: "var(--accent)", color: "white" } : { color: "var(--text-muted)" }}>{label}</button>)}</nav>

    {tab === "quotes" ? <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]"><QuoteList rows={quotes} saving={saving} onView={setSelectedQuote} onEdit={editQuote} onTransition={transitionQuote} onConvert={convertQuote} /><QuoteEditor form={quoteForm} setForm={setQuoteForm} editing={editingQuote} setEditing={setEditingQuote} products={products} customers={customers} saving={saving === "quote"} onSubmit={saveQuote} /></section> : null}
    {tab === "creditNotes" ? <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]"><CreditNoteList rows={creditNotes} /><CreditNoteForm form={creditForm} setForm={setCreditForm} invoice={selectedCreditInvoice} invoices={invoices} usage={creditUsage} saving={saving === "credit"} onSubmit={submitCreditNote} /></section> : null}
    {tab === "returns" ? <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]"><SalesReturnList rows={returns} /><SalesReturnForm form={returnForm} setForm={setReturnForm} invoice={selectedReturnInvoice} invoices={invoices} usage={returnUsage} saving={saving === "return"} onSubmit={submitReturn} /></section> : null}
    {selectedQuote && tab === "quotes" ? <QuoteDetail quote={selectedQuote} onClose={() => setSelectedQuote(null)} /> : null}
  </div>;
};

const normalizeQuotePayload = (form, productMap) => ({ ...form, lineItems: form.lineItems.map((line) => { const product = productMap.get(String(line.productId)); return { ...line, quantity: Number(line.quantity || 0), rate: Number(line.rate || product?.sellingPrice || 0), taxRate: Number(line.taxRate || product?.taxRate || 0), discountValue: Number(line.discountValue || 0) }; }) });
const usageByInvoiceLine = (rows, invoiceId, field) => rows.filter((row) => String(row.invoiceId?._id || row.invoiceId) === String(invoiceId)).reduce((map, row) => { (row.lineItems || []).forEach((line) => map.set(Number(line.invoiceLineIndex), Number(map.get(Number(line.invoiceLineIndex)) || 0) + Number(line[field] || 0))); return map; }, new Map());
const lineValue = (line, quantity) => Number(line.quantity || 0) > 0 ? Number(line.itemTotal || 0) * Number(quantity || 0) / Number(line.quantity || 1) : 0;

const Field = ({ label, children }) => <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}</label>;
const TableShell = ({ title, description, children }) => <section className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><div><h3 className="text-lg font-semibold">{title}</h3>{description ? <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{description}</p> : null}</div><div className="mt-4 overflow-x-auto rounded-xl border" style={{ borderColor: "var(--panel-border)" }}>{children}</div></section>;

const QuoteList = ({ rows, saving, onView, onEdit, onTransition, onConvert }) => <TableShell title="Quotation list" description="Draft quotes can be edited. Accepted quotes can be converted exactly once."><table className="min-w-[880px] w-full text-left text-sm"><thead className="bg-slate-500/5 text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}><tr><th className="p-3">Quote #</th><th className="p-3">Customer</th><th className="p-3">Created</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id} className="border-t" style={{ borderColor: "var(--panel-border)" }}><td className="p-3 font-semibold">{row.quoteNumber}</td><td className="p-3">{row.customerSnapshot?.name || row.customerId?.name || "Customer"}</td><td className="p-3">{date(row.createdAt)}</td><td className="p-3 text-right">{money(row.grandTotal)}</td><td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(row.status)}`}>{row.status}</span></td><td className="p-3"><div className="flex flex-wrap justify-end gap-2"><button onClick={() => onView(row)} className="rounded-lg border px-2.5 py-1.5 text-xs" style={{ borderColor: "var(--panel-border)" }}>View</button>{row.status === "DRAFT" ? <><button onClick={() => onEdit(row)} className="rounded-lg border px-2.5 py-1.5 text-xs" style={{ borderColor: "var(--panel-border)" }}>Edit</button><button disabled={saving === `${row._id}-SENT`} onClick={() => onTransition(row, "SENT")} className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white">Send</button></> : null}{row.status === "SENT" ? <><button onClick={() => onTransition(row, "ACCEPTED")} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white">Accept</button><button onClick={() => onTransition(row, "REJECTED")} className="rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-600">Reject</button><button onClick={() => onTransition(row, "EXPIRED")} className="rounded-lg border px-2.5 py-1.5 text-xs" style={{ borderColor: "var(--panel-border)" }}>Expire</button></> : null}{row.status === "ACCEPTED" ? <button onClick={() => onConvert(row)} className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white">Convert</button> : null}{row.status === "CONVERTED" ? <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-700">Converted</span> : null}</div></td></tr>)}{!rows.length ? <tr><td colSpan="6" className="p-8"><EmptyState title="No quotes yet" description="Create a quote to begin the sales lifecycle." /></td></tr> : null}</tbody></table></TableShell>;

const QuoteEditor = ({ form, setForm, editing, setEditing, products, customers, saving, onSubmit }) => {
  const updateLine = (index, patch) => setForm((value) => ({ ...value, lineItems: value.lineItems.map((line, i) => i === index ? { ...line, ...patch } : line) }));
  const addLine = () => setForm((value) => ({ ...value, lineItems: [...value.lineItems, blankQuoteLine()] }));
  const removeLine = (index) => setForm((value) => ({ ...value, lineItems: value.lineItems.filter((_, i) => i !== index) || [blankQuoteLine()] }));
  return <form onSubmit={onSubmit} className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{editing ? "Edit draft quote" : "Create quote"}</h3><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Server calculates authoritative totals and quote number.</p></div>{editing ? <button type="button" onClick={() => { setEditing(null); setForm(blankQuoteForm()); }}><X size={18} /></button> : null}</div><div className="mt-4 grid gap-4"><Field label="Customer"><select required value={form.customerId} onChange={(event) => setForm((value) => ({ ...value, customerId: event.target.value }))} className="field"><option value="">Select customer</option>{customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name}</option>)}</select></Field><div className="space-y-3">{form.lineItems.map((line, index) => <div key={index} className="rounded-xl border p-3" style={{ borderColor: "var(--panel-border)" }}><div className="grid gap-3 sm:grid-cols-2"><Field label="Product"><select required value={line.productId} onChange={(event) => { const product = products.find((item) => item._id === event.target.value); updateLine(index, { productId: event.target.value, rate: product?.sellingPrice || line.rate, taxRate: product?.taxRate || line.taxRate }); }} className="field"><option value="">Select product</option>{products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}</select></Field><Field label="Quantity"><input required type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} className="field" /></Field><Field label="Rate"><input type="number" min="0" step="0.01" value={line.rate} onChange={(event) => updateLine(index, { rate: event.target.value })} className="field" /></Field><Field label="GST/tax rate"><input type="number" min="0" step="0.01" value={line.taxRate} onChange={(event) => updateLine(index, { taxRate: event.target.value })} className="field" /></Field><Field label="Discount"><input type="number" min="0" step="0.01" value={line.discountValue} onChange={(event) => updateLine(index, { discountValue: event.target.value })} className="field" /></Field><Field label="Discount type"><select value={line.discountType} onChange={(event) => updateLine(index, { discountType: event.target.value })} className="field"><option value="percent">Percent</option><option value="amount">Amount</option></select></Field></div>{form.lineItems.length > 1 ? <button type="button" onClick={() => removeLine(index)} className="mt-3 text-sm text-rose-600">Remove line</button> : null}</div>)}</div><button type="button" onClick={addLine} className="rounded-xl border px-4 py-2.5 text-sm font-medium" style={{ borderColor: "var(--panel-border)" }}>Add line</button><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"><Send size={16} /> {saving ? "Saving..." : editing ? "Update draft quote" : "Create quote"}</button></div></form>;
};

const QuoteDetail = ({ quote, onClose }) => <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-4"><div className="mx-auto my-6 w-full max-w-3xl rounded-2xl border p-6 shadow-2xl" style={{ borderColor: "var(--panel-border)", background: "var(--theme-surface-strong)" }}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-brand-600">Quote detail</p><h3 className="mt-1 text-2xl font-semibold">{quote.quoteNumber}</h3><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{quote.customerSnapshot?.name || "Customer"} · {date(quote.createdAt)}</p></div><button onClick={onClose}><X size={20} /></button></div><div className="mt-5 overflow-x-auto rounded-xl border" style={{ borderColor: "var(--panel-border)" }}><table className="min-w-[650px] w-full text-left text-sm"><thead className="bg-slate-500/5 text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}><tr><th className="p-3">Item</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Tax</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{quote.lineItems?.map((line, index) => <tr key={index} className="border-t" style={{ borderColor: "var(--panel-border)" }}><td className="p-3 font-medium">{line.productName}</td><td className="p-3 text-right">{line.quantity}</td><td className="p-3 text-right">{money(line.rate)}</td><td className="p-3 text-right">{money(line.tax)}</td><td className="p-3 text-right">{money(line.itemTotal)}</td></tr>)}</tbody></table></div><div className="ml-auto mt-5 max-w-xs space-y-2 text-sm"><Amount label="Subtotal" value={money(quote.subtotal)} /><Amount label="Discount" value={money(quote.totalDiscount)} /><Amount label="Tax" value={money(quote.totalTax)} /><Amount label="Grand total" value={money(quote.grandTotal)} strong /></div></div></div>;

const CreditNoteList = ({ rows }) => <TableShell title="Credit notes" description="Issued credit notes are immutable and create customer ledger credit events."><table className="min-w-[780px] w-full text-left text-sm"><thead className="bg-slate-500/5 text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}><tr><th className="p-3">Credit note</th><th className="p-3">Invoice</th><th className="p-3">Customer</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th><th className="p-3">Created</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id} className="border-t" style={{ borderColor: "var(--panel-border)" }}><td className="p-3 font-semibold">{row.creditNoteNumber}</td><td className="p-3">{row.invoiceId?.invoiceNumber || String(row.invoiceId || "").slice(-8)}</td><td className="p-3">{row.customerId?.name || "Customer"}</td><td className="p-3 text-right">{money(row.totalAmount)}</td><td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(row.status)}`}>{row.status}</span></td><td className="p-3">{date(row.createdAt)}</td></tr>)}{!rows.length ? <tr><td colSpan="6" className="p-8"><EmptyState title="No credit notes" description="Issue a partial or full credit against an eligible invoice." /></td></tr> : null}</tbody></table></TableShell>;

const CreditNoteForm = ({ form, setForm, invoice, invoices, usage, saving, onSubmit }) => <form onSubmit={onSubmit} className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><h3 className="text-lg font-semibold">Issue credit note</h3><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Frontend shows remaining eligibility for speed; backend is authoritative.</p><div className="mt-4 grid gap-4"><Field label="Eligible invoice"><select required value={form.invoiceId} onChange={(event) => { const next = invoices.find((item) => item._id === event.target.value); setForm({ invoiceId: event.target.value, lineItems: (next?.lineItems || []).map((line, index) => ({ invoiceLineIndex: index, productId: line.productId?._id || line.productId, quantity: 0, amount: 0 })) }); }} className="field"><option value="">Select invoice</option>{invoices.filter((invoice) => invoice.status !== "cancelled").map((invoice) => <option key={invoice._id} value={invoice._id}>{invoice.invoiceNumber} · {money(invoice.grandTotal)}</option>)}</select></Field>{invoice?.lineItems?.map((line, index) => { const remainingAmount = Math.max(Number(line.itemTotal || 0) - Number(usage.get(index) || 0), 0); const selectedLine = form.lineItems[index] || {}; return <div key={index} className="rounded-xl border p-3" style={{ borderColor: "var(--panel-border)" }}><p className="font-medium">{line.productName}</p><p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Sold {line.quantity} · remaining credit value {money(remainingAmount)}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Credit quantity"><input type="number" min="0" step="0.01" value={selectedLine.quantity || ""} onChange={(event) => setForm((value) => ({ ...value, lineItems: value.lineItems.map((row, i) => i === index ? { ...row, quantity: event.target.value, amount: lineValue(line, event.target.value) } : row) }))} className="field" /></Field><Field label="Credit amount"><input type="number" min="0" step="0.01" max={remainingAmount} value={selectedLine.amount || ""} onChange={(event) => setForm((value) => ({ ...value, lineItems: value.lineItems.map((row, i) => i === index ? { ...row, amount: event.target.value } : row) }))} className="field" /></Field></div></div>; })}<button disabled={saving || !form.invoiceId} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"><FileText size={16} /> {saving ? "Issuing..." : "Issue credit note"}</button></div></form>;

const SalesReturnList = ({ rows }) => <TableShell title="Sales returns" description="Returns restore inventory through RETURN stock movements and post a customer ledger adjustment."><table className="min-w-[760px] w-full text-left text-sm"><thead className="bg-slate-500/5 text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}><tr><th className="p-3">Return</th><th className="p-3">Invoice</th><th className="p-3">Customer</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th><th className="p-3">Created</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id} className="border-t" style={{ borderColor: "var(--panel-border)" }}><td className="p-3 font-semibold">{row.returnNumber}</td><td className="p-3">{row.invoiceId?.invoiceNumber || String(row.invoiceId || "").slice(-8)}</td><td className="p-3">{row.customerId?.name || "Customer"}</td><td className="p-3 text-right">{money(row.totalAmount)}</td><td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(row.status)}`}>{row.status}</span></td><td className="p-3">{date(row.createdAt)}</td></tr>)}{!rows.length ? <tr><td colSpan="6" className="p-8"><EmptyState title="No sales returns" description="Process returns from eligible invoice lines." /></td></tr> : null}</tbody></table></TableShell>;

const SalesReturnForm = ({ form, setForm, invoice, invoices, usage, saving, onSubmit }) => <form onSubmit={onSubmit} className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><h3 className="text-lg font-semibold">Create sales return</h3><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Sold, returned, and remaining quantities are shown before submission.</p><div className="mt-4 grid gap-4"><Field label="Eligible invoice"><select required value={form.invoiceId} onChange={(event) => { const next = invoices.find((item) => item._id === event.target.value); setForm({ invoiceId: event.target.value, lineItems: (next?.lineItems || []).map((line, index) => ({ invoiceLineIndex: index, productId: line.productId?._id || line.productId, quantity: 0 })) }); }} className="field"><option value="">Select invoice</option>{invoices.filter((invoice) => invoice.status !== "cancelled").map((invoice) => <option key={invoice._id} value={invoice._id}>{invoice.invoiceNumber} · {money(invoice.grandTotal)}</option>)}</select></Field>{invoice?.lineItems?.map((line, index) => { const returned = Number(usage.get(index) || 0); const remaining = Math.max(Number(line.quantity || 0) - returned, 0); const selectedLine = form.lineItems[index] || {}; return <div key={index} className="rounded-xl border p-3" style={{ borderColor: "var(--panel-border)" }}><p className="font-medium">{line.productName}</p><p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Sold {line.quantity} · already returned {returned} · remaining {remaining}</p><Field label="Return quantity"><input type="number" min="0" max={remaining} step="0.01" value={selectedLine.quantity || ""} onChange={(event) => setForm((value) => ({ ...value, lineItems: value.lineItems.map((row, i) => i === index ? { ...row, quantity: event.target.value } : row) }))} className="field" /></Field></div>; })}<button disabled={saving || !form.invoiceId} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"><RotateCcw size={16} /> {saving ? "Processing..." : "Issue sales return"}</button></div></form>;

const Amount = ({ label, value, strong }) => <div className={`flex items-center justify-between gap-4 ${strong ? "border-t pt-3 text-base font-semibold" : ""}`} style={strong ? { borderColor: "var(--panel-border)" } : {}}><span style={{ color: "var(--text-muted)" }}>{label}</span><span>{value}</span></div>;

export default SalesLifecyclePage;
