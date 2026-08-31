import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Boxes, Building2, Check, FileText, MessageCircle, ReceiptIndianRupee, Users } from "lucide-react";
import { getIndustryCatalogueRequest, updateBusinessProfileRequest, updateBusinessSetupRequest, workspaceRecommendationRequest } from "../api";
import { authStore } from "../../../store/authStore";

const businessModels = [
  { key: "PRODUCT", label: "Product", icon: Boxes, copy: "I sell physical or packaged products." },
  { key: "SERVICE", label: "Service", icon: FileText, copy: "I provide services and bill clients." },
  { key: "TRADING", label: "Trading", icon: ReceiptIndianRupee, copy: "I buy, stock, and resell goods." },
  { key: "MANUFACTURING", label: "Manufacturing", icon: Building2, copy: "I make or process goods." },
  { key: "PROJECT_BASED", label: "Project based", icon: Users, copy: "I quote, deliver, and bill project work." },
  { key: "RECURRING", label: "Recurring", icon: MessageCircle, copy: "I run renewals, retainers, or memberships." },
  { key: "MIXED", label: "Mixed", icon: ReceiptIndianRupee, copy: "My business combines multiple styles." },
];

const fallbackNeeds = [
  { code: "GST", label: "I create GST invoices", status: "IMPLEMENTED" },
  { code: "QUOTATIONS", label: "I send quotations", status: "IMPLEMENTED" },
  { code: "INVENTORY", label: "I manage stock", status: "IMPLEMENTED" },
  { code: "PURCHASES", label: "I buy from suppliers", status: "IMPLEMENTED" },
  { code: "EXPENSES", label: "I track business expenses", status: "IMPLEMENTED" },
  { code: "COMMUNICATIONS", label: "I send payment reminders", status: "IMPLEMENTED" },
  { code: "RECURRING_BILLING", label: "I need recurring billing", status: "FUTURE" },
  { code: "PROJECTS", label: "I work on projects", status: "FUTURE" },
  { code: "APPOINTMENTS", label: "I take appointments", status: "FUTURE" },
  { code: "E_INVOICE", label: "I need e-invoicing readiness", status: "IMPLEMENTED" },
  { code: "API_INTEGRATION", label: "I need API integrations", status: "IMPLEMENTED" },
];

const fallbackIndustries = [
  {
    code: "OTHER",
    displayName: "Other / general business",
    description: "A flexible setup for businesses that do not fit one preset category yet.",
    defaultBusinessModel: "MIXED",
    supportedPlayerTypes: [
      { code: "GENERAL_BUSINESS", displayName: "General business", businessModel: "MIXED", recommendedNeeds: ["GST", "INVOICING", "EXPENSES"] },
    ],
  },
];

const moduleLabels = {
  customers: "Customers",
  products_services: "Products & Services",
  quotations: "Quotations",
  invoices: "Invoices",
  payments: "Payments",
  ledger: "Customer Statements & Ledger",
  credit_notes: "Credit Notes",
  expenses: "Expenses",
  reports: "Reports",
  communications: "Communications",
  inventory: "Inventory",
  suppliers: "Suppliers",
  purchases: "Purchases",
  sales_returns: "Sales Returns",
  gst: "GST",
  hr: "HR",
};

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { business, updateBusiness } = authStore();
  const [step, setStep] = useState(1);
  const [catalogue, setCatalogue] = useState({ industries: fallbackIndustries, capabilities: fallbackNeeds });
  const [recommendation, setRecommendation] = useState(null);
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: business?.name || "",
    industryCode: business?.businessProfile?.industryCode || "OTHER",
    industry: business?.industry || "Other",
    playerTypeCode: business?.businessProfile?.playerTypeCode || "",
    playerType: business?.businessProfile?.playerType || "",
    email: business?.email || business?.billingEmail || "",
    phone: business?.phone || "",
    address: business?.address || "",
    businessModel: business?.businessProfile?.businessModel || "SERVICE",
    businessSize: business?.businessProfile?.businessSize || "SMALL",
    numberOfUsers: business?.businessProfile?.numberOfUsers || 1,
    numberOfLocations: business?.businessProfile?.numberOfLocations || 1,
    gstRegistered: business?.businessProfile?.gstRegistered || false,
    selectedNeeds: business?.businessProfile?.selectedNeeds || ["GST", "QUOTATIONS", "EXPENSES"],
  });

  useEffect(() => {
    getIndustryCatalogueRequest()
      .then((data) => {
        setCatalogue({
          industries: data.industries?.length ? data.industries : fallbackIndustries,
          capabilities: data.capabilities?.length ? data.capabilities : fallbackNeeds,
        });
      })
      .catch(() => setCatalogue({ industries: fallbackIndustries, capabilities: fallbackNeeds }));
  }, []);

  const selectedIndustry = useMemo(
    () => catalogue.industries.find((item) => item.code === form.industryCode) || catalogue.industries.find((item) => item.code === "OTHER"),
    [catalogue.industries, form.industryCode]
  );
  const playerTypes = selectedIndustry?.supportedPlayerTypes || [];
  const needs = catalogue.capabilities.length ? catalogue.capabilities : fallbackNeeds;

  useEffect(() => {
    if (!selectedIndustry) return;
    setForm((current) => {
      const player = selectedIndustry.supportedPlayerTypes?.find((item) => item.code === current.playerTypeCode) || selectedIndustry.supportedPlayerTypes?.[0];
      return {
        ...current,
        industry: selectedIndustry.displayName,
        playerTypeCode: player?.code || "",
        playerType: player?.displayName || "",
        businessModel: current.businessModel || player?.businessModel || selectedIndustry.defaultBusinessModel || "MIXED",
      };
    });
  }, [selectedIndustry?.code]);

  useEffect(() => {
    if (step !== 6) return;
    workspaceRecommendationRequest(form)
      .then(setRecommendation)
      .catch((error) => setServerError(error.response?.data?.message || "Unable to generate workspace recommendation"));
  }, [step]);

  const toggleNeed = (code) => {
    setForm((current) => ({
      ...current,
      selectedNeeds: current.selectedNeeds.includes(code)
        ? current.selectedNeeds.filter((item) => item !== code)
        : [...current.selectedNeeds, code],
    }));
  };

  const selectPlayer = (player) => {
    setForm((current) => ({
      ...current,
      playerTypeCode: player.code,
      playerType: player.displayName,
      businessModel: player.businessModel || current.businessModel,
    }));
  };

  const submit = async () => {
    setIsSubmitting(true);
    setServerError("");
    try {
      const selectedModules = recommendation?.recommendedModules || [];
      const setupPayload = new FormData();
      Object.entries({
        name: form.name,
        industry: form.industry,
        email: form.email,
        billingEmail: form.email,
        phone: form.phone,
        address: form.address,
        gstTaxId: "",
        invoiceTerms: "Payment due as per invoice terms.",
        taxName: "GST",
        taxRate: 18,
        taxMode: "exclusive",
        invoicePrefix: "INV",
        invoiceNumberingFormat: "INV-{YYYY}-{0001}",
        allowNegativeStock: false,
        gstRegistered: form.gstRegistered,
        businessModel: form.businessModel,
        playerType: form.playerType,
        businessSize: form.businessSize,
        numberOfUsers: form.numberOfUsers,
        numberOfLocations: form.numberOfLocations,
        selectedNeeds: form.selectedNeeds.join(","),
        selectedModules: selectedModules.join(","),
        preset: form.businessModel,
      }).forEach(([key, value]) => setupPayload.append(key, value ?? ""));

      const updated = await updateBusinessSetupRequest(setupPayload);
      const profiled = await updateBusinessProfileRequest({
        ...form,
        selectedModules,
        preset: form.businessModel,
      });
      updateBusiness(profiled || updated);
      navigate("/dashboard");
    } catch (error) {
      setServerError(error.response?.data?.message || "Unable to finish setup");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canContinue = step !== 1 || Boolean(form.name);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-panel sm:p-8">
          <p className="text-sm uppercase tracking-[0.35em] text-brand-300">BillStack setup</p>
          <h1 className="mt-4 text-3xl font-semibold">Build a workspace that fits your business</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            Choose an industry, player type, model, and practical needs. BillStack recommends modules without locking you into a vertical fork.
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-7">
            {[1, 2, 3, 4, 5, 6, 7].map((item) => <div key={item} className={`h-2 rounded-full ${item <= step ? "bg-brand-500" : "bg-white/10"}`} />)}
          </div>
        </header>

        <main className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 sm:p-8">
          {step === 1 ? <IdentityStep form={form} setForm={setForm} /> : null}
          {step === 2 ? <IndustryStep industries={catalogue.industries} value={form.industryCode} onSelect={(industry) => setForm((v) => ({ ...v, industryCode: industry.code, industry: industry.displayName, businessModel: industry.defaultBusinessModel || v.businessModel }))} /> : null}
          {step === 3 ? <PlayerStep playerTypes={playerTypes} selected={form.playerTypeCode} onSelect={selectPlayer} /> : null}
          {step === 4 ? <BusinessModelStep models={businessModels} value={form.businessModel} onSelect={(businessModel) => setForm((v) => ({ ...v, businessModel }))} /> : null}
          {step === 5 ? <NeedsStep needs={needs} selected={form.selectedNeeds} onToggle={toggleNeed} /> : null}
          {step === 6 ? <RecommendationStep recommendation={recommendation} moduleLabels={moduleLabels} /> : null}
          {step === 7 ? <FinishStep form={form} recommendation={recommendation} /> : null}

          {serverError ? <p className="mt-5 text-sm text-rose-300">{serverError}</p> : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button type="button" disabled={step === 1 || isSubmitting} onClick={() => setStep((value) => Math.max(1, value - 1))} className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold disabled:opacity-40">Back</button>
            {step < 7 ? (
              <button type="button" disabled={!canContinue} onClick={() => setStep((value) => Math.min(7, value + 1))} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold disabled:opacity-50">
                Continue <ArrowRight size={17} />
              </button>
            ) : (
              <button type="button" disabled={isSubmitting || !form.name} onClick={submit} className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
                {isSubmitting ? "Finishing setup..." : "Finish setup"}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

const IdentityStep = ({ form, setForm }) => (
  <section>
    <h2 className="text-2xl font-semibold">Business identity</h2>
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {[["name", "Business name"], ["email", "Business email"], ["phone", "Phone"], ["address", "Address"], ["businessSize", "Business size"], ["numberOfUsers", "Number of users"], ["numberOfLocations", "Number of locations"]].map(([name, label]) => (
        <label key={name} className={name === "address" ? "md:col-span-2" : ""}>
          <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
          <input type={name.startsWith("number") ? "number" : "text"} value={form[name]} onChange={(event) => setForm((v) => ({ ...v, [name]: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-brand-500" />
        </label>
      ))}
      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 md:col-span-2">
        <input type="checkbox" checked={form.gstRegistered} onChange={(event) => setForm((v) => ({ ...v, gstRegistered: event.target.checked }))} /> GST registered
      </label>
    </div>
  </section>
);

const IndustryStep = ({ industries, value, onSelect }) => (
  <section>
    <h2 className="text-2xl font-semibold">Choose your industry</h2>
    <p className="mt-2 text-sm text-slate-400">This guides recommendations only. It does not create a separate industry app.</p>
    <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {industries.map((industry) => <button key={industry.code} type="button" onClick={() => onSelect(industry)} className={`rounded-2xl border p-4 text-left ${value === industry.code ? "border-brand-400 bg-brand-500/15" : "border-white/10 bg-slate-950/50 hover:bg-white/5"}`}><p className="font-semibold">{industry.displayName}</p><p className="mt-2 text-sm text-slate-400">{industry.description}</p></button>)}
    </div>
  </section>
);

const PlayerStep = ({ playerTypes, selected, onSelect }) => (
  <section>
    <h2 className="text-2xl font-semibold">What type of player are you?</h2>
    <p className="mt-2 text-sm text-slate-400">Same industry, different workflows. Pick the closest fit; you can still customize later.</p>
    <div className="mt-6 grid gap-3 md:grid-cols-2">
      {playerTypes.map((player) => <button key={player.code} type="button" onClick={() => onSelect(player)} className={`rounded-2xl border p-4 text-left ${selected === player.code ? "border-brand-400 bg-brand-500/15" : "border-white/10 bg-slate-950/50 hover:bg-white/5"}`}><p className="font-semibold">{player.displayName}</p><p className="mt-2 text-sm text-slate-400">Suggested model: {player.businessModel}</p></button>)}
    </div>
  </section>
);

const BusinessModelStep = ({ models, value, onSelect }) => (
  <section>
    <h2 className="text-2xl font-semibold">Confirm business model</h2>
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {models.map((model) => { const Icon = model.icon; return <button key={model.key} type="button" onClick={() => onSelect(model.key)} className={`rounded-3xl border p-5 text-left transition ${value === model.key ? "border-brand-400 bg-brand-500/15" : "border-white/10 bg-slate-950/50 hover:bg-white/5"}`}><Icon size={24} className={value === model.key ? "text-brand-200" : "text-slate-400"} /><p className="mt-4 font-semibold">{model.label}</p><p className="mt-2 text-sm text-slate-400">{model.copy}</p></button>; })}
    </div>
  </section>
);

const NeedsStep = ({ needs, selected, onToggle }) => (
  <section>
    <h2 className="text-2xl font-semibold">What do you need?</h2>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {needs.map((need) => {
        const isSelected = selected.includes(need.code);
        return <button key={need.code} type="button" onClick={() => onToggle(need.code)} className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-left ${isSelected ? "border-brand-400 bg-brand-500/15" : "border-white/10 bg-slate-950/50"}`}><span><span className="block">{need.label}</span><span className={`mt-1 block text-xs ${need.status === "IMPLEMENTED" ? "text-emerald-300" : "text-amber-300"}`}>{need.status === "IMPLEMENTED" ? "Ready now" : "Future / request only"}</span></span>{isSelected ? <Check size={18} className="text-brand-200" /> : null}</button>;
      })}
    </div>
  </section>
);

const RecommendationStep = ({ recommendation, moduleLabels }) => (
  <section>
    <h2 className="text-2xl font-semibold">Recommended workspace</h2>
    {!recommendation ? <p className="mt-4 text-sm text-slate-400">Generating recommendation...</p> : <>
      <p className="mt-2 text-sm text-slate-400">{recommendation.industry?.displayName} · {recommendation.playerType?.displayName || "Custom"} · {recommendation.businessModel}</p>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {recommendation.recommendedModules.map((moduleKey) => <div key={moduleKey} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><p className="font-semibold">{moduleLabels[moduleKey] || moduleKey}</p><p className="mt-2 text-xs text-emerald-300">Recommended</p></div>)}
      </div>
      {recommendation.futureCapabilities?.length ? <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4"><p className="font-semibold text-amber-200">Future capabilities noted</p><p className="mt-2 text-sm text-amber-100/80">{recommendation.futureCapabilities.map((item) => item.label).join(", ")} are not enabled as live modules yet.</p></div> : null}
      <div className="mt-5 rounded-2xl border border-brand-400/20 bg-brand-500/10 p-4"><p className="font-semibold">Recommended plan: {recommendation.recommendedPlan?.recommendedPlanCode?.toUpperCase()}</p><p className="mt-1 text-sm text-slate-300">{recommendation.recommendedPlan?.reasons?.join(" ")}</p></div>
    </>}
  </section>
);

const FinishStep = ({ form, recommendation }) => (
  <section>
    <h2 className="text-2xl font-semibold">Finish setup</h2>
    <p className="mt-2 text-sm text-slate-400">We will save your profile and activate eligible implemented modules. Future workflow packs remain request-only.</p>
    <div className="mt-6 rounded-3xl border border-brand-400/30 bg-brand-500/10 p-5">
      <p className="font-semibold">{form.name || "Your business"}</p>
      <p className="mt-2 text-sm text-slate-300">{form.industry} · {form.playerType || "Custom"} · {form.businessModel}</p>
      <p className="mt-2 text-sm text-slate-300">{recommendation?.recommendedModules?.length || 0} modules recommended</p>
    </div>
  </section>
);

export default OnboardingPage;
