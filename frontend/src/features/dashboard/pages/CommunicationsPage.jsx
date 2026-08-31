import { useEffect, useState } from "react";
import { BellRing, CalendarClock, CheckCircle2, CircleAlert, Mail, MessageCircle, RefreshCw, Send, Settings, Smartphone } from "lucide-react";
import { communicationDeliveriesRequest, communicationRulesRequest, communicationScheduledRequest, communicationSummaryRequest, communicationTemplatesRequest, createCommunicationRuleRequest, upsertCommunicationTemplateRequest } from "../../auth/api";
import { EmptyState, LoadingState } from "../../../components/ui/PageState";
import { uiStore } from "../../../store/uiStore";

const dateTime = (value) => value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));
const statusClass = (status) => status === "SENT" || status === "DELIVERED" || status === "READ" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : status === "FAILED" ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : status === "SKIPPED" || status === "CANCELLED" ? "bg-slate-500/10 text-slate-600 dark:text-slate-300" : "bg-brand-500/10 text-brand-700 dark:text-brand-200";

const CommunicationsPage = () => {
  const [tab, setTab] = useState("overview");
  const [summary, setSummary] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [rules, setRules] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ruleForm, setRuleForm] = useState({ name: "3 days before due date", trigger: "BEFORE_DUE", offsetDays: 3, channel: "EMAIL", sendTime: "10:00" });
  const [templateForm, setTemplateForm] = useState({ name: "", category: "PAYMENT_REMINDER", channel: "EMAIL", subject: "", body: "" });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryData, templateData, ruleData, scheduledData, deliveryData] = await Promise.all([
        communicationSummaryRequest(),
        communicationTemplatesRequest(),
        communicationRulesRequest(),
        communicationScheduledRequest(),
        communicationDeliveriesRequest(),
      ]);
      setSummary(summaryData);
      setTemplates(templateData);
      setRules(ruleData);
      setScheduled(scheduledData);
      setDeliveries(deliveryData);
    } catch (loadError) {
      setError(loadError.response?.data?.message || "Unable to load communications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createRule = async (event) => {
    event.preventDefault();
    try {
      await createCommunicationRuleRequest(ruleForm);
      uiStore.getState().pushToast({ tone: "success", message: "Reminder rule saved." });
      await load();
    } catch (saveError) {
      setError(saveError.response?.data?.message || "Unable to save reminder rule.");
    }
  };

  const saveTemplate = async (event) => {
    event.preventDefault();
    try {
      await upsertCommunicationTemplateRequest(templateForm);
      uiStore.getState().pushToast({ tone: "success", message: "Communication template saved." });
      setTemplateForm({ name: "", category: "PAYMENT_REMINDER", channel: "EMAIL", subject: "", body: "" });
      await load();
    } catch (saveError) {
      setError(saveError.response?.data?.message || "Unable to save template.");
    }
  };

  if (loading) return <LoadingState title="Loading communications" description="Fetching reminder rules, templates, and delivery logs." />;

  const metrics = [
    ["Messages sent", summary?.messagesSent || 0, Send],
    ["Scheduled reminders", summary?.scheduledReminders || 0, CalendarClock],
    ["Failed messages", summary?.failedMessages || 0, CircleAlert],
    ["Delivered/read", summary?.deliveredMessages || 0, CheckCircle2],
  ];

  return <div className="mx-auto max-w-[1500px] space-y-6 pb-8">
    <section className="flex flex-col gap-4 rounded-2xl border p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
      <div><p className="text-sm font-medium text-brand-600">Communications</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">WhatsApp, email and payment reminders</h2><p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--text-muted)" }}>Durable reminder automation for invoices. WhatsApp is provider-ready and stays disabled until BillStack's WhatsApp Business API is configured.</p></div>
      <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--panel-border)" }}><RefreshCw size={16} /> Refresh</button>
    </section>
    {error ? <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-200">{error}</div> : null}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, Icon]) => <div key={label} className="rounded-xl border p-4" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}><div className="flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p><Icon size={18} className="text-brand-600" /></div><p className="mt-3 text-2xl font-semibold">{value}</p></div>)}</section>
    <div className="flex gap-2 overflow-x-auto">{["overview", "reminders", "templates", "scheduled", "delivery logs", "settings"].map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-xl px-3 py-2 text-sm font-medium capitalize ${tab === item ? "bg-brand-600 text-white" : "border"}`} style={tab === item ? {} : { borderColor: "var(--panel-border)", color: "var(--text-muted)" }}>{item}</button>)}</div>
    {tab === "overview" ? <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"><ReminderTable rows={summary?.upcoming || []} /><ProviderSettings status={summary?.providerStatus} /></section> : null}
    {tab === "reminders" ? <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]"><ReminderTable rows={scheduled} /><RuleForm form={ruleForm} setForm={setRuleForm} providerStatus={summary?.providerStatus} onSubmit={createRule} /></section> : null}
    {tab === "templates" ? <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]"><TemplateGrid templates={templates} /><TemplateForm form={templateForm} setForm={setTemplateForm} providerStatus={summary?.providerStatus} onSubmit={saveTemplate} /></section> : null}
    {tab === "scheduled" ? <ReminderTable rows={scheduled} /> : null}
    {tab === "delivery logs" ? <DeliveryTable rows={deliveries} /> : null}
    {tab === "settings" ? <ProviderSettings status={summary?.providerStatus} /> : null}
  </div>;
};

const ReminderTable = ({ rows }) => (
  <section className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
    <h3 className="text-lg font-semibold">Payment reminders</h3>
    <div className="mt-4 overflow-x-auto rounded-xl border" style={{ borderColor: "var(--panel-border)" }}>
      <table className="min-w-[780px] w-full text-left text-sm">
        <thead className="bg-slate-500/5 text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          <tr><th className="p-3">Customer</th><th className="p-3">Invoice</th><th className="p-3 text-right">Outstanding</th><th className="p-3">Due date</th><th className="p-3">Next reminder</th><th className="p-3">Channel</th><th className="p-3">Status</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id} className="border-t" style={{ borderColor: "var(--panel-border)" }}>
              <td className="p-3 font-medium">{row.customerId?.name || "Customer"}</td>
              <td className="p-3">{row.invoiceId?.invoiceNumber || "-"}</td>
              <td className="p-3 text-right">{money(row.outstandingAmountSnapshot || row.invoiceId?.balanceDue)}</td>
              <td className="p-3">{dateTime(row.invoiceId?.dueDate)}</td>
              <td className="p-3">{dateTime(row.scheduledFor)}</td>
              <td className="p-3">{row.channel}</td>
              <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(row.status)}`}>{row.status}</span></td>
            </tr>
          ))}
          {!rows.length ? <tr><td colSpan="7" className="p-8"><EmptyState title="No reminders scheduled" description="Schedule reminders from invoice detail or create automation rules." /></td></tr> : null}
        </tbody>
      </table>
    </div>
  </section>
);

const DeliveryTable = ({ rows }) => (
  <section className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
    <h3 className="text-lg font-semibold">Delivery logs</h3>
    <div className="mt-4 overflow-x-auto rounded-xl border" style={{ borderColor: "var(--panel-border)" }}>
      <table className="min-w-[760px] w-full text-left text-sm">
        <thead className="bg-slate-500/5 text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          <tr><th className="p-3">Channel</th><th className="p-3">Recipient</th><th className="p-3">Invoice</th><th className="p-3">Status</th><th className="p-3">Failure</th><th className="p-3">Created</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id} className="border-t" style={{ borderColor: "var(--panel-border)" }}>
              <td className="p-3">{row.channel}</td>
              <td className="p-3">{row.recipient || "-"}</td>
              <td className="p-3">{row.invoiceId?.invoiceNumber || "-"}</td>
              <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(row.status)}`}>{row.status}</span></td>
              <td className="p-3" style={{ color: "var(--text-muted)" }}>{row.failureReason || "-"}</td>
              <td className="p-3">{dateTime(row.createdAt)}</td>
            </tr>
          ))}
          {!rows.length ? <tr><td colSpan="6" className="p-8"><EmptyState title="No delivery history" description="Messages and reminders will appear here after they are attempted." /></td></tr> : null}
        </tbody>
      </table>
    </div>
  </section>
);
const TemplateGrid = ({ templates }) => (
  <section className="grid gap-4 md:grid-cols-2">
    {templates.map((template) => (
      <article key={template._id} className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">{template.name}</h3>
          <span className="rounded-full bg-brand-500/10 px-2 py-1 text-xs text-brand-700 dark:text-brand-200">{template.channel}</span>
        </div>
        <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>{template.body}</p>
        <p className="mt-4 text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{template.category}</p>
      </article>
    ))}
  </section>
);

const TemplateForm = ({ form, setForm, providerStatus, onSubmit }) => {
  const channels = channelOptions(providerStatus);
  return <form onSubmit={onSubmit} className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
    <h3 className="text-lg font-semibold">Template management</h3>
    <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Create or update templates supported by the communications backend. Provider-gated channels remain disabled until configured.</p>
    <div className="mt-4 grid gap-4">
      <Field label="Template name"><input required value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} className="field" /></Field>
      <Field label="Category"><select value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))} className="field"><option value="PAYMENT_REMINDER">Payment reminder</option><option value="INVOICE_SHARE">Invoice share</option><option value="CUSTOM">Custom</option></select></Field>
      <Field label="Channel"><select value={form.channel} onChange={(event) => setForm((value) => ({ ...value, channel: event.target.value }))} className="field">{channels.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select></Field>
      <Field label="Subject"><input value={form.subject} onChange={(event) => setForm((value) => ({ ...value, subject: event.target.value }))} className="field" /></Field>
      <Field label="Body"><textarea required rows="6" value={form.body} onChange={(event) => setForm((value) => ({ ...value, body: event.target.value }))} className="field" /></Field>
    </div>
    <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white"><Mail size={16} /> Save template</button>
  </form>;
};

const RuleForm = ({ form, setForm, providerStatus, onSubmit }) => {
  const channels = channelOptions(providerStatus);
  return (
  <form onSubmit={onSubmit} className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
    <h3 className="text-lg font-semibold">Automation rule</h3>
    <div className="mt-4 grid gap-4">
      <Field label="Rule name"><input value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} className="field" /></Field>
      <Field label="Trigger"><select value={form.trigger} onChange={(event) => setForm((value) => ({ ...value, trigger: event.target.value }))} className="field"><option value="BEFORE_DUE">Before due date</option><option value="ON_DUE_DATE">Due date</option><option value="AFTER_DUE">After due date</option><option value="RECURRING_OVERDUE">Recurring overdue</option></select></Field>
      <Field label="Offset days"><input type="number" value={form.offsetDays} onChange={(event) => setForm((value) => ({ ...value, offsetDays: event.target.value }))} className="field" /></Field>
      <Field label="Channel"><select value={form.channel} onChange={(event) => setForm((value) => ({ ...value, channel: event.target.value }))} className="field">{channels.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select></Field>
      <Field label="Send time"><input value={form.sendTime} onChange={(event) => setForm((value) => ({ ...value, sendTime: event.target.value }))} className="field" /></Field>
    </div>
    <button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white"><BellRing size={16} /> Enable rule</button>
  </form>
  );
};

const channelOptions = (status) => [
  { value: "EMAIL", label: status?.email?.configured === false ? "Email (SMTP not configured)" : "Email", disabled: status?.email?.configured === false },
  { value: "WHATSAPP", label: status?.whatsapp?.configured ? "WhatsApp" : "WhatsApp (not configured)", disabled: !status?.whatsapp?.configured },
  { value: "SMS", label: status?.sms?.configured ? "SMS" : "SMS (not configured)", disabled: !status?.sms?.configured },
  { value: "IN_APP", label: "In-app", disabled: false },
];

const ProviderSettings = ({ status }) => (
  <section className="rounded-2xl border p-5" style={{ borderColor: "var(--panel-border)", background: "var(--panel-bg)" }}>
    <div className="flex items-center gap-2"><Settings size={18} className="text-brand-600" /><h3 className="text-lg font-semibold">Channel settings</h3></div>
    <div className="mt-4 space-y-3">
      <ProviderRow icon={MessageCircle} label="WhatsApp Business API" configured={status?.whatsapp?.configured} note={status?.whatsapp?.configured ? "Configured through environment" : "Not configured. Native BillStack WhatsApp flow is disabled."} />
      <ProviderRow icon={Mail} label="Email" configured={status?.email?.configured} note={status?.email?.configured ? "SMTP configured" : "SMTP not configured"} />
      <ProviderRow icon={Smartphone} label="SMS" configured={status?.sms?.configured} note="Provider-ready only. No SMS provider configured." />
    </div>
  </section>
);

const ProviderRow = ({ icon: Icon, label, configured, note }) => (
  <div className="rounded-xl border p-4" style={{ borderColor: "var(--panel-border)" }}>
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 font-medium"><Icon size={17} /> {label}</span>
      <span className={`rounded-full px-2 py-1 text-xs ${configured ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-200"}`}>{configured ? "Connected" : "Not configured"}</span>
    </div>
    <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{note}</p>
  </div>
);

const Field = ({ label, children }) => <label><span className="mb-2 block text-sm font-medium">{label}</span>{children}</label>;

export default CommunicationsPage;
