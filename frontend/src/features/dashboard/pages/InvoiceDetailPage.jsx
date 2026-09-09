import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BellRing, CheckCircle2, CircleAlert, Download, FileCheck2, Mail, MessageCircle, QrCode, ShieldCheck, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui/PageState";
import { uiStore } from "../../../store/uiStore";
import {
  cancelInvoiceRequest,
  checkEInvoiceReadinessRequest,
  communicationDeliveriesRequest,
  communicationScheduledRequest,
  communicationSummaryRequest,
  communicationTemplatesRequest,
  downloadInvoicePdfRequest,
  emailInvoiceRequest,
  getEInvoiceDetailsRequest,
  getInvoiceRequest,
  listInvoiceAllocationsRequest,
  prepareEInvoicePayloadRequest,
  scheduleInvoiceReminderRequest,
  sendInvoiceCommunicationRequest,
} from "../../auth/api";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
const date = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const timestamp = (value) => value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const status = (invoice) => invoice.status === "cancelled" ? ["Cancelled", "bg-slate-500/10 text-slate-700 dark:text-slate-200"] : invoice.paymentStatus === "paid" ? ["Paid", "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"] : invoice.paymentStatus === "partial" ? ["Partially paid", "bg-amber-500/10 text-amber-700 dark:text-amber-300"] : Number(invoice.balanceDue || 0) > 0 && new Date(invoice.dueDate) < new Date() ? ["Overdue", "bg-rose-500/10 text-rose-700 dark:text-rose-300"] : ["Pending", "bg-brand-500/10 text-brand-700 dark:text-brand-200"];
const templateCategoryLabel = (value) => ({ INVOICE_CREATED: "Invoice Created", DUE_TODAY: "Payment Due Today", PAYMENT_OVERDUE: "Payment Overdue", PAYMENT_REMINDER: "Payment Reminder", PAYMENT_RECEIVED: "Payment Received", CREDIT_NOTE: "Credit Note", SALES_RETURN: "Sales Return", QUOTATION: "Quotation", CUSTOM: "Custom" }[value] || String(value || "Custom").replaceAll("_", " "));

const InvoiceDetailPage = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [eInvoice, setEInvoice] = useState(null);
  const [eInvoiceResult, setEInvoiceResult] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [providerStatus, setProviderStatus] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [communicationForm, setCommunicationForm] = useState({ channel: "EMAIL", category: "INVOICE_CREATED", templateId: "" });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getInvoiceRequest(invoiceId);
      setInvoice(data);
      try {
        setEInvoice(await getEInvoiceDetailsRequest(invoiceId));
      } catch {
        setEInvoice(data.eInvoice || null);
      }
      try {
        const [deliveryRows, reminderRows, allocationRows, communicationData, templateRows] = await Promise.all([
          communicationDeliveriesRequest({ invoiceId }),
          communicationScheduledRequest({ invoiceId }),
          listInvoiceAllocationsRequest(invoiceId),
          communicationSummaryRequest(),
          communicationTemplatesRequest(),
        ]);
        setDeliveries(deliveryRows || []);
        setReminders(reminderRows || []);
        setAllocations(allocationRows || []);
        setProviderStatus(communicationData?.providerStatus || null);
        setTemplates(templateRows || []);
      } catch {
        setDeliveries([]);
        setReminders([]);
        setAllocations([]);
        setProviderStatus(null);
        setTemplates([]);
      }
    } catch (err) {
      setError(err.response?.status === 404 ? "Invoice not found." : err.response?.data?.message || "Unable to load invoice.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [invoiceId]);

  const download = async () => {
    try {
      setActive("pdf");
      const blob = await downloadInvoicePdfRequest(invoice._id, true);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      uiStore.getState().pushToast({ tone: "success", message: "Invoice PDF downloaded." });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to download invoice PDF.");
    } finally {
      setActive("");
    }
  };

  const email = async () => {
    const recipient = window.prompt("Send invoice to email:", invoice.customerId?.email || invoice.customerDetails?.email || "");
    if (!recipient) return;
    try {
      setActive("email");
      await emailInvoiceRequest(invoice._id, recipient);
      uiStore.getState().pushToast({ tone: "success", message: "Invoice emailed successfully." });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to email invoice.");
    } finally {
      setActive("");
    }
  };

  const checkReadiness = async () => {
    try {
      setActive("echeck");
      const data = await checkEInvoiceReadinessRequest(invoice._id);
      setEInvoice(data.metadata);
      setEInvoiceResult(data);
      uiStore.getState().pushToast({ tone: data.readiness?.readiness === "READY" ? "success" : "info", message: data.readiness?.readiness === "READY" ? "Invoice is e-invoice ready." : "E-invoice readiness needs attention." });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to check e-invoice readiness.");
    } finally {
      setActive("");
    }
  };

  const preparePayload = async () => {
    try {
      setActive("epayload");
      const data = await prepareEInvoicePayloadRequest(invoice._id);
      setEInvoice(data.metadata);
      setEInvoiceResult(data);
      uiStore.getState().pushToast({ tone: "success", message: "Validated e-invoice payload prepared. IRP submission is not configured." });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to prepare e-invoice payload.");
    } finally {
      setActive("");
    }
  };

  const sendViaChannel = async () => {
    const channel = communicationForm.channel;
    try {
      setActive(`send-${channel}`);
      const row = await sendInvoiceCommunicationRequest(invoice._id, { channel, category: communicationForm.category, templateId: communicationForm.templateId || undefined });
      uiStore.getState().pushToast({ tone: row.status === "SENT" ? "success" : "info", message: row.status === "SENT" ? `${channel} message sent.` : `${channel} message recorded as ${row.status}.` });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || `Unable to send via ${channel}.`);
    } finally {
      setActive("");
    }
  };

  const scheduleReminder = async () => {
    const scheduledFor = window.prompt("Schedule reminder at ISO date/time:", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
    if (!scheduledFor) return;
    try {
      setActive("schedule-reminder");
      await scheduleInvoiceReminderRequest(invoice._id, { channel: "EMAIL", scheduledFor });
      uiStore.getState().pushToast({ tone: "success", message: "Reminder scheduled." });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to schedule reminder.");
    } finally {
      setActive("");
    }
  };

  const cancel = async () => {
    try {
      setActive("cancel");
      await cancelInvoiceRequest(invoice._id);
      setShowCancel(false);
      uiStore.getState().pushToast({ tone: "success", message: "Invoice cancelled successfully." });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to cancel invoice.");
    } finally {
      setActive("");
    }
  };

  if (loading) return <LoadingState title="Loading invoice" description="Fetching invoice details for this business." />;
  if (!invoice) return <ErrorState title="Invoice unavailable" description={error || "The requested invoice could not be found."} />;

  const [paymentLabel, paymentClass] = status(invoice);
  const customer = invoice.customerId || invoice.customerDetails || {};
  const business = invoice.businessDetails || {};

  return <div className="mx-auto max-w-[1500px] space-y-6 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <button onClick={() => navigate("/dashboard/invoices")} className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: "var(--text-muted)" }}><ArrowLeft size={17} /> Back to invoices</button>
      <div className="flex flex-wrap gap-2">
        <button disabled={active === "pdf"} onClick={download} className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm" style={{ borderColor: "var(--panel-border)" }}><Download size={16} /> {active === "pdf" ? "Preparing..." : "Download PDF"}</button>
        <button disabled={active === "email"} onClick={email} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white"><Mail size={16} /> {active === "email" ? "Sending..." : "Email invoice"}</button>
      </div>
    </div>
    {error ? <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/25 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-200"><span className="flex gap-2"><CircleAlert size={18} />{error}</span><button onClick={() => setError("")}>×</button></div> : null}

    <section className="rounded-2xl border p-5 sm:p-7" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div><p className="text-sm font-medium text-brand-600">Invoice document</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{invoice.invoiceNumber}</h2><p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Issued {date(invoice.invoiceDate)} · Due {date(invoice.dueDate)}</p></div>
        <div className="flex flex-wrap gap-2"><span className={`rounded-full px-3 py-1.5 text-sm font-medium ${paymentClass}`}>{paymentLabel}</span><span className="rounded-full bg-slate-500/10 px-3 py-1.5 text-sm font-medium capitalize" style={{ color: "var(--text-muted)" }}>{invoice.status}</span></div>
      </div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
      <main className="space-y-6">
        <section className="rounded-2xl border p-5 sm:p-7" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
          <div className="grid gap-8 sm:grid-cols-2"><Party title="From" party={business} /><Party title="Bill to" party={customer} link={customer._id ? () => navigate("/dashboard/customers") : null} /></div>
          <div className="mt-8 overflow-x-auto rounded-xl border" style={{ borderColor: "var(--panel-border)" }}>
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-slate-500/[.05] text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}><tr><th className="p-3.5">Item</th><th className="p-3.5 text-right">Quantity</th><th className="p-3.5 text-right">Rate</th><th className="p-3.5 text-right">Discount</th><th className="p-3.5 text-right">Tax/GST</th><th className="p-3.5 text-right">Amount</th></tr></thead>
              <tbody>{invoice.lineItems?.map((item, index) => <tr key={`${item.productId}-${index}`} className="border-t" style={{ borderColor: "var(--panel-border)" }}><td className="p-3.5 font-medium">{item.productName}<p className="mt-1 text-xs font-normal" style={{ color: "var(--text-muted)" }}>{invoice.gstSnapshot?.lines?.[index]?.hsnSac ? `HSN/SAC ${invoice.gstSnapshot.lines[index].hsnSac}` : ""}</p></td><td className="p-3.5 text-right">{item.quantity}</td><td className="p-3.5 text-right">{money(item.rate)}</td><td className="p-3.5 text-right">{money(item.discount)}</td><td className="p-3.5 text-right">{item.taxRate ? `${item.taxRate}% · ${money(item.tax)}` : "—"}</td><td className="p-3.5 text-right font-semibold">{money(item.itemTotal)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="ml-auto mt-5 max-w-sm space-y-3 text-sm"><AmountRow label="Subtotal" value={money(invoice.subtotal)} /><AmountRow label="Discount" value={`− ${money(invoice.totalDiscount)}`} /><AmountRow label="Tax/GST" value={money(invoice.totalTax)} />{Number(invoice.shippingCharges) ? <AmountRow label="Shipping" value={money(invoice.shippingCharges)} /> : null}{Number(invoice.roundOff) ? <AmountRow label="Round-off" value={money(invoice.roundOff)} /> : null}<div className="flex justify-between border-t pt-3 text-base font-semibold" style={{ borderColor: "var(--panel-border)" }}><span>Grand total</span><span>{money(invoice.grandTotal)}</span></div></div>
        </section>
        <section className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><h3 className="text-lg font-semibold">Notes & terms</h3><div className="mt-4 grid gap-5 md:grid-cols-2"><div><p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Notes</p><p className="mt-2 text-sm">{invoice.notes || "No notes provided."}</p></div><div><p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Terms & conditions</p><p className="mt-2 text-sm">{invoice.termsAndConditions || "No terms provided."}</p></div></div></section>
        <section className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><h3 className="text-lg font-semibold">Activity</h3><div className="mt-4"><Timeline invoice={invoice} /></div></section>
      </main>
      <aside className="space-y-6">
        <GstEInvoicePanel invoice={invoice} eInvoice={eInvoice || invoice.eInvoice} result={eInvoiceResult} active={active} onCheck={checkReadiness} onPrepare={preparePayload} />
        <CommunicationPanel deliveries={deliveries} reminders={reminders} templates={templates} form={communicationForm} setForm={setCommunicationForm} providerStatus={providerStatus} active={active} onSend={sendViaChannel} onSchedule={scheduleReminder} />
        <PaymentSummary invoice={invoice} paymentLabel={paymentLabel} paymentClass={paymentClass} />
        <PaymentAllocations invoice={invoice} rows={allocations} />
        <section className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><h3 className="text-lg font-semibold">Document details</h3><dl className="mt-4 space-y-3 text-sm"><AmountRow label="Created" value={timestamp(invoice.createdAt)} /><AmountRow label="Last updated" value={timestamp(invoice.updatedAt)} /></dl></section>
        {invoice.status !== "cancelled" ? <section className="rounded-2xl border border-rose-500/30 p-5"><h3 className="text-lg font-semibold text-rose-600">Invoice actions</h3><p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Cancellation is consequential and reverses the invoice stock impact.</p><button onClick={() => setShowCancel(true)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/40 px-4 py-2.5 text-sm font-medium text-rose-600"><Trash2 size={16} /> Cancel invoice</button></section> : null}
      </aside>
    </div>

    {showCancel ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"><div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl" style={{ borderColor: "var(--panel-border)", background: "var(--theme-surface-strong)" }}><CircleAlert className="text-rose-600" /><h3 className="mt-4 text-lg font-semibold">Cancel this invoice?</h3><p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Invoice <strong>{invoice.invoiceNumber}</strong> will be cancelled and its stock impact reversed. This cannot be undone.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setShowCancel(false)} disabled={active === "cancel"} className="rounded-xl border px-4 py-2.5 text-sm" style={{ borderColor: "var(--panel-border)" }}>Keep invoice</button><button onClick={cancel} disabled={active === "cancel"} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{active === "cancel" ? "Cancelling..." : "Cancel invoice"}</button></div></div></div> : null}
  </div>;
};

const Party = ({ title, party, link }) => <div><p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{title}</p>{link ? <button onClick={link} className="mt-2 text-left text-lg font-semibold text-brand-600 hover:underline">{party.name || "Customer"}</button> : <p className="mt-2 text-lg font-semibold">{party.name || "Business"}</p>}<div className="mt-2 space-y-1 text-sm" style={{ color: "var(--text-muted)" }}>{party.email ? <p>{party.email}</p> : null}{party.phone ? <p>{party.phone}</p> : null}{party.address || party.billingAddress ? <p>{party.address || party.billingAddress}</p> : null}{party.gstNumber ? <p>GST: {party.gstNumber}</p> : null}</div></div>;
const AmountRow = ({ label, value }) => <div className="flex items-center justify-between gap-4"><span style={{ color: "var(--text-muted)" }}>{label}</span><span className="text-right font-medium">{value}</span></div>;

const PaymentSummary = ({ invoice, paymentLabel, paymentClass }) => <section className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><p className="text-sm font-medium text-brand-600">Payment summary</p><h3 className="mt-1 text-lg font-semibold">Derived payment state</h3><div className="mt-5 space-y-3"><AmountRow label="Amount paid" value={money(invoice.amountPaid)} /><AmountRow label="Balance due" value={money(invoice.balanceDue)} /><AmountRow label="Payment status" value={<span className={`rounded-full px-2.5 py-1 text-xs font-medium ${paymentClass}`}>{paymentLabel}</span>} /></div>{invoice.financialRead?.reconciliation?.status && invoice.financialRead.reconciliation.status !== "OK" ? <p className="mt-5 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">Reconciliation: {invoice.financialRead.reconciliation.status}. Review allocation history before changing financial values.</p> : <p className="mt-5 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-200">Allocation-backed invoices use PaymentAllocation as the financial source, with legacy fields preserved for API compatibility.</p>}</section>;

const PaymentAllocations = ({ invoice, rows }) => {
  const enriched = useMemo(() => {
    let running = 0;
    return (rows || []).map((row) => {
      running += Number(row.allocatedAmount || 0);
      return { ...row, remainingAfter: Math.max(Number(invoice.grandTotal || 0) - running, 0) };
    });
  }, [invoice.grandTotal, rows]);
  return <section className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><h3 className="text-lg font-semibold">Payment allocation history</h3>{enriched.length ? <div className="mt-4 space-y-3">{enriched.map((row) => <div key={row.allocationId || row._id} className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--panel-border)" }}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{money(row.allocatedAmount)}</p><p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{date(row.payment?.paymentDate || row.createdAt)} · {row.payment?.paymentMethod || "Method not captured"}</p></div><span className={`rounded-full px-2 py-1 text-xs ${row.reversal ? "bg-rose-500/10 text-rose-700" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>{row.reversal ? "Reversed" : "Active"}</span></div><dl className="mt-3 grid gap-2 text-xs"><AmountRow label="Reference" value={row.payment?.referenceNumber || row.paymentId || "—"} /><AmountRow label="Direction" value={row.payment?.direction || "RECEIVED"} /><AmountRow label="Payment status" value={row.payment?.status || "POSTED"} /><AmountRow label="Remaining after allocation" value={money(row.remainingAfter)} /></dl></div>)}</div> : <EmptyState title="No payment allocations yet" description="Payments allocated through the payment workflow will appear here with date, method, reference, and remaining balance." />}</section>;
};

const GstEInvoicePanel = ({ invoice, eInvoice, result, active, onCheck, onPrepare }) => {
  const breakup = invoice.gstBreakup || {};
  const snapshot = invoice.gstSnapshot || {};
  const firstLine = snapshot.lines?.[0] || {};
  const statusLabel = eInvoice?.eInvoiceStatus || eInvoice?.status || (invoice.gstSnapshot ? "READY" : "NOT_REQUIRED");
  const errors = result?.readiness?.errors || [];
  return <section className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-brand-600">GST & e-invoice</p><h3 className="mt-1 text-lg font-semibold">Compliance snapshot</h3></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusLabel === "READY" || statusLabel === "GENERATED" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : statusLabel === "FAILED" ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "bg-slate-500/10 text-slate-600 dark:text-slate-300"}`}>{statusLabel}</span></div>{invoice.gstSnapshot ? <div className="mt-4 space-y-2 text-sm"><AmountRow label="Taxable value" value={money(breakup.taxableValue || snapshot.taxableValue)} /><AmountRow label="CGST" value={money(breakup.cgst || snapshot.cgst)} /><AmountRow label="SGST" value={money(breakup.sgst || snapshot.sgst)} /><AmountRow label="IGST" value={money(breakup.igst || snapshot.igst)} /><AmountRow label="HSN/SAC" value={firstLine.hsnSac || Object.keys(breakup.hsnSacSummary || {})[0] || "Not captured"} /><AmountRow label="GST rate" value={firstLine.rate !== undefined ? `${firstLine.rate}%` : "Mixed"} /><AmountRow label="Supply" value={snapshot.supplierStateCode && snapshot.placeOfSupplyCode && snapshot.supplierStateCode === snapshot.placeOfSupplyCode ? "Intra-state" : "Inter-state"} /><AmountRow label="Place of supply" value={snapshot.placeOfSupplyCode || "Not captured"} /></div> : <p className="mt-4 rounded-xl bg-slate-500/10 p-3 text-sm" style={{ color: "var(--text-muted)" }}>This is a legacy or non-GST invoice. No GST snapshot is available.</p>}{eInvoice?.irn ? <div className="mt-4 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-200"><p className="flex items-center gap-2 font-medium"><ShieldCheck size={16} /> IRN available</p><p className="mt-1 break-all">{eInvoice.irn}</p>{eInvoice.acknowledgementNumber ? <p className="mt-1">Ack: {eInvoice.acknowledgementNumber}</p> : null}</div> : <p className="mt-4 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">Government IRP submission is not configured. BillStack can validate readiness and prepare the payload only.</p>}{errors.length ? <div className="mt-4 space-y-2">{errors.map((error) => <p key={error.code + error.message} className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">{error.code}: {error.message}</p>)}</div> : result?.readiness?.readiness === "READY" ? <p className="mt-4 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={15} /> Readiness validation passed.</p> : null}<div className="mt-5 grid gap-2"><button type="button" onClick={onCheck} disabled={active === "echeck"} className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium" style={{ borderColor: "var(--panel-border)" }}><FileCheck2 size={16} /> {active === "echeck" ? "Checking..." : "Check readiness"}</button><button type="button" onClick={onPrepare} disabled={active === "epayload" || !invoice.gstSnapshot} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><QrCode size={16} /> {active === "epayload" ? "Preparing..." : "Prepare e-invoice"}</button></div></section>;
};

const CommunicationPanel = ({ deliveries, reminders, templates, form, setForm, providerStatus, active, onSend, onSchedule }) => {
  const whatsappReady = Boolean(providerStatus?.whatsapp?.configured);
  const emailReady = providerStatus?.email?.configured !== false;
  const matchingTemplates = (templates || []).filter((template) => template.isActive !== false && template.channel === form.channel && template.category === form.category);
  const canSend = form.channel === "EMAIL" ? emailReady : form.channel === "WHATSAPP" ? whatsappReady : false;
  return <section className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><p className="text-sm font-medium text-brand-600">Communications</p><h3 className="mt-1 text-lg font-semibold">Send and remind</h3><p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>Choose a matching active template or use the default. WhatsApp and SMS stay disabled until their providers are configured.</p><div className="mt-4 grid gap-2"><label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Channel<select value={form.channel} onChange={(event) => setForm((value) => ({ ...value, channel: event.target.value, templateId: "" }))} className="field mt-2"><option value="EMAIL" disabled={!emailReady}>Email{emailReady ? "" : " (not configured)"}</option><option value="WHATSAPP" disabled={!whatsappReady}>WhatsApp{whatsappReady ? "" : " (not configured)"}</option></select></label><label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Category<select value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value, templateId: "" }))} className="field mt-2"><option value="INVOICE_CREATED">Invoice Created</option><option value="DUE_TODAY">Payment Due Today</option><option value="PAYMENT_OVERDUE">Payment Overdue</option><option value="PAYMENT_REMINDER">Payment Reminder</option></select></label><label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Template<select value={form.templateId || ""} onChange={(event) => setForm((value) => ({ ...value, templateId: event.target.value }))} className="field mt-2"><option value="">Use default template</option>{matchingTemplates.map((template) => <option key={template._id} value={template._id}>{template.name}{template.isDefault ? " (default)" : ""}</option>)}</select></label><button onClick={onSend} disabled={active === `send-${form.channel}` || !canSend} className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium disabled:opacity-50" style={{ borderColor: "var(--panel-border)" }}>{form.channel === "WHATSAPP" ? <MessageCircle size={16} /> : <Mail size={16} />} {active === `send-${form.channel}` ? "Sending..." : canSend ? `Send ${templateCategoryLabel(form.category)}` : `${form.channel} not configured`}</button><button onClick={onSchedule} disabled={active === "schedule-reminder" || !emailReady} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><BellRing size={16} /> {active === "schedule-reminder" ? "Scheduling..." : "Schedule email reminder"}</button></div><div className="mt-5 space-y-3"><HistoryBlock title="Upcoming reminders" rows={reminders} empty="No reminders scheduled." mapper={(row) => `${row.channel} / ${row.status} / ${row.scheduledFor ? new Date(row.scheduledFor).toLocaleString("en-IN") : "-"}`} /><HistoryBlock title="Delivery status" rows={deliveries} empty="No message history yet." mapper={(row) => `${row.channel} / ${row.status}${row.failureReason ? ` / ${row.failureReason}` : ""}`} /></div></section>;
};

const HistoryBlock = ({ title, rows, mapper, empty }) => <div><p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{title}</p>{rows.slice(0, 3).map((row) => <p key={row._id} className="mt-2 rounded-lg bg-slate-500/10 px-3 py-2 text-xs">{mapper(row)}</p>)}{!rows.length ? <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>{empty}</p> : null}</div>;
const Timeline = ({ invoice }) => <div className="space-y-4 border-l pl-4" style={{ borderColor: "var(--panel-border)" }}><div><p className="font-medium">Invoice created</p><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{timestamp(invoice.createdAt)}</p></div>{invoice.updatedAt && invoice.updatedAt !== invoice.createdAt ? <div><p className="font-medium">Invoice last updated</p><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{timestamp(invoice.updatedAt)}</p></div> : null}{invoice.status === "cancelled" ? <div><p className="font-medium">Invoice cancelled</p><p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>The current API does not provide a separate cancellation timestamp.</p></div> : null}</div>;

export default InvoiceDetailPage;
