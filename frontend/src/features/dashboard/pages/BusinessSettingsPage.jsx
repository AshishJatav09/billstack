import { useEffect, useMemo, useState } from "react";
import {
  communicationSummaryRequest,
  acceptModuleOfferRequest,
  createModuleRequestRequest,
  createModuleRazorpayOrderRequest,
  createIntegrationCredentialRequest,
  declineModuleOfferRequest,
  getBusinessModulesRequest,
  listIntegrationCredentialsRequest,
  listIntegrationEventsRequest,
  revokeIntegrationCredentialRequest,
  submitModuleManualUpiRequest,
  updateBusinessModuleStateRequest,
  updateBusinessSetupRequest,
  verifyModuleRazorpayPaymentRequest,
} from "../../auth/api";
import { authStore } from "../../../store/authStore";

const getApiOrigin = () => {
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
  return apiBase.replace(/\/api$/, "");
};

const loadRazorpayCheckout = () =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Checkout is unavailable"));
    if (window.Razorpay) return resolve(window.Razorpay);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("Unable to load Razorpay Checkout"));
    document.body.appendChild(script);
  });

const BusinessSettingsPage = () => {
  const { business, updateBusiness, user } = authStore();
  const [form, setForm] = useState({
    name: business?.name || "",
    email: business?.email || "",
    billingEmail: business?.billingEmail || "",
    phone: business?.phone || "",
    address: business?.address || "",
    gstTaxId: business?.gstTaxId || "",
    gstEnabled: business?.gstConfiguration?.enabled || false,
    gstConfigurationGstin: business?.gstConfiguration?.gstin || business?.gstTaxId || "",
    gstStateCode: business?.gstConfiguration?.stateCode || "",
    gstState: business?.gstConfiguration?.state || "",
    invoiceTerms: business?.invoiceTerms || "",
    taxName: business?.defaultTaxSettings?.taxName || "GST",
    taxRate: business?.defaultTaxSettings?.taxRate ?? 18,
    taxMode: business?.defaultTaxSettings?.taxMode || "exclusive",
    invoicePrefix: business?.invoiceNumbering?.prefix || "INV",
    invoiceNumberingFormat: business?.invoiceNumbering?.format || "INV-{YYYY}-{0001}",
    bankAccountName: business?.bankDetails?.accountName || "",
    bankName: business?.bankDetails?.bankName || "",
    bankAccountNumber: business?.bankDetails?.accountNumber || "",
    bankIfscCode: business?.bankDetails?.ifscCode || "",
    bankUpiId: business?.bankDetails?.upiId || "",
    industry: business?.industry || "",
    allowNegativeStock: business?.inventorySettings?.allowNegativeStock || false,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [communicationSummary, setCommunicationSummary] = useState(null);
  const [integrationCredentials, setIntegrationCredentials] = useState([]);
  const [integrationEvents, setIntegrationEvents] = useState([]);
  const [newIntegrationKey, setNewIntegrationKey] = useState("");
  const [integrationError, setIntegrationError] = useState("");
  const [moduleData, setModuleData] = useState(null);
  const [moduleMessage, setModuleMessage] = useState("");
  const [moduleError, setModuleError] = useState("");

  const logoPreviewUrl = useMemo(() => {
    if (logoFile) return URL.createObjectURL(logoFile);
    if (business?.logoUrl) return `${getApiOrigin()}${business.logoUrl}`;
    return "";
  }, [business?.logoUrl, logoFile]);

  const refreshIntegrationData = async () => {
    try {
      const [credentials, events] = await Promise.all([
        listIntegrationCredentialsRequest(),
        listIntegrationEventsRequest({ limit: 5 }),
      ]);
      setIntegrationCredentials(credentials);
      setIntegrationEvents(events);
    } catch (_error) {
      setIntegrationCredentials([]);
      setIntegrationEvents([]);
    }
  };

  useEffect(() => {
    communicationSummaryRequest()
      .then(setCommunicationSummary)
      .catch(() => setCommunicationSummary(null));
    refreshIntegrationData();
    refreshModules();
  }, []);

  const refreshModules = async () => {
    try {
      const data = await getBusinessModulesRequest();
      setModuleData(data);
    } catch (_error) {
      setModuleData(null);
    }
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveError("");
    setFieldErrors({});

    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value ?? ""));

      if (logoFile) payload.append("logo", logoFile);

      const data = await updateBusinessSetupRequest(payload);
      updateBusiness(data);
      setLogoFile(null);
    } catch (error) {
      setFieldErrors(error.response?.data?.errors || {});
      setSaveError(error.response?.data?.message || "Unable to update business profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateIntegrationKey = async () => {
    setIntegrationError("");
    setNewIntegrationKey("");
    try {
      const result = await createIntegrationCredentialRequest({
        name: "Website / CRM integration",
        source: "API",
      });
      setNewIntegrationKey(result.apiKey);
      await refreshIntegrationData();
    } catch (error) {
      setIntegrationError(error.response?.data?.message || "Unable to create integration key");
    }
  };

  const handleRevokeIntegrationKey = async (credentialId) => {
    setIntegrationError("");
    try {
      await revokeIntegrationCredentialRequest(credentialId);
      await refreshIntegrationData();
    } catch (error) {
      setIntegrationError(error.response?.data?.message || "Unable to revoke integration key");
    }
  };

  const handleModuleState = async (moduleKey, state) => {
    setModuleError("");
    setModuleMessage("");
    try {
      await updateBusinessModuleStateRequest(moduleKey, state);
      setModuleMessage("Module settings updated.");
      await refreshModules();
    } catch (error) {
      setModuleError(error.response?.data?.message || "Unable to update module");
    }
  };

  const handleModuleRequest = async (moduleKey) => {
    setModuleError("");
    setModuleMessage("");
    try {
      await createModuleRequestRequest({
        moduleKey,
        requestType: "MODULE",
        message: `Please review access for ${moduleKey}.`,
      });
      setModuleMessage("Module request submitted for review.");
    } catch (error) {
      setModuleError(error.response?.data?.message || "Unable to request module");
    }
  };

  const handleAcceptOffer = async (offerId) => {
    setModuleError("");
    setModuleMessage("");
    try {
      await acceptModuleOfferRequest(offerId);
      setModuleMessage("Offer accepted. Complete payment if required to activate the module.");
      await refreshModules();
    } catch (error) {
      setModuleError(error.response?.data?.message || "Unable to accept offer");
    }
  };

  const handleDeclineOffer = async (offerId) => {
    setModuleError("");
    setModuleMessage("");
    try {
      await declineModuleOfferRequest(offerId);
      setModuleMessage("Offer declined.");
      await refreshModules();
    } catch (error) {
      setModuleError(error.response?.data?.message || "Unable to decline offer");
    }
  };

  const handleRazorpayAddon = async (offerId) => {
    setModuleError("");
    setModuleMessage("");
    try {
      const checkout = await createModuleRazorpayOrderRequest(offerId);
      if (!checkout.razorpayKeyId) {
        setModuleMessage("Razorpay order could not be opened because provider credentials are not configured.");
        await refreshModules();
        return;
      }

      const Razorpay = await loadRazorpayCheckout();
      const razorpay = new Razorpay({
        key: checkout.razorpayKeyId,
        order_id: checkout.razorpayOrderId,
        amount: Math.round(Number(checkout.amount || 0) * 100),
        currency: checkout.currency || "INR",
        name: "BillStack",
        description: "Module add-on payment",
        handler: async (response) => {
          try {
            await verifyModuleRazorpayPaymentRequest(response);
            setModuleMessage("Payment verified. Module activation is being applied.");
            await refreshModules();
          } catch (error) {
            setModuleError(error.response?.data?.message || "Payment could not be verified");
          }
        },
        modal: {
          ondismiss: async () => {
            setModuleMessage("Razorpay checkout was closed before payment completion.");
            await refreshModules();
          },
        },
        prefill: {
          name: user?.name || "",
          email: user?.email || business?.email || "",
          contact: business?.phone || "",
        },
        notes: {
          orderId: checkout.orderId,
        },
        theme: { color: "#2563eb" },
      });
      razorpay.open();
    } catch (error) {
      setModuleError(error.response?.data?.message || "Unable to create Razorpay order");
    }
  };

  const handleManualUpi = async (offerId) => {
    const utrReference = window.prompt("Enter UTR / transaction reference for manual UPI payment");
    if (!utrReference) return;
    setModuleError("");
    setModuleMessage("");
    try {
      await submitModuleManualUpiRequest(offerId, {
        utrReference,
        paymentDate: new Date().toISOString(),
      });
      setModuleMessage("Manual UPI payment submitted. Activation waits for super-admin verification.");
      await refreshModules();
    } catch (error) {
      setModuleError(error.response?.data?.message || "Unable to submit manual UPI payment");
    }
  };

  return (
    <div className="space-y-6">
      <section className="theme-hero rounded-[2rem] p-6 sm:p-8">
        <p className="theme-hero-kicker text-sm uppercase tracking-[0.3em]">Business Settings</p>
        <h2 className="theme-hero-title mt-3 text-3xl font-semibold">Profile, GST, billing defaults, and integrations</h2>
        <p className="theme-hero-copy mt-3 max-w-3xl text-sm">
          Manage business identity, invoice defaults, GST setup, inventory preferences,
          provider readiness, and secure integration keys.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={handleProfileSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Business Profile</h3>
              <p className="mt-2 text-sm text-slate-400">Role: {user?.role}</p>
            </div>
            {logoPreviewUrl ? (
              <img src={logoPreviewUrl} alt="Business logo" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-sm text-slate-300">Logo</div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["name", "Business name"],
              ["industry", "Industry"],
              ["email", "Business email"],
              ["billingEmail", "Billing email"],
              ["phone", "Phone"],
              ["gstTaxId", "GST / Tax ID"],
              ["invoicePrefix", "Invoice prefix"],
              ["invoiceNumberingFormat", "Invoice numbering format"],
              ["taxName", "Tax name"],
              ["taxRate", "Default tax rate"],
              ["bankAccountName", "Bank account name"],
              ["bankName", "Bank name"],
              ["bankAccountNumber", "Account number"],
              ["bankIfscCode", "IFSC code"],
              ["bankUpiId", "UPI ID"],
            ].map(([name, label]) => (
              <label key={name} className={name === "invoiceNumberingFormat" || name === "bankUpiId" ? "md:col-span-2" : "block"}>
                <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
                <input
                  name={name}
                  value={form[name]}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500"
                />
                {fieldErrors[name] ? <span className="mt-2 block text-xs text-rose-400">{fieldErrors[name]}</span> : null}
              </label>
            ))}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Tax mode</span>
              <select
                name="taxMode"
                value={form.taxMode}
                onChange={handleChange}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500"
              >
                <option value="exclusive">Exclusive</option>
                <option value="inclusive">Inclusive</option>
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-200">Address</span>
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-200">Invoice terms</span>
              <textarea
                name="invoiceTerms"
                rows="4"
                value={form.invoiceTerms}
                onChange={handleChange}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-200">Logo upload</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-white"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 md:col-span-2">
              <input type="checkbox" name="allowNegativeStock" checked={form.allowNegativeStock} onChange={handleChange} />
              Allow negative stock when recording stock out
            </label>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 md:col-span-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Indian GST configuration</p>
                  <p className="mt-1 text-xs text-slate-400">
                    GST snapshots and e-invoice readiness use these business details.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input type="checkbox" name="gstEnabled" checked={form.gstEnabled} onChange={handleChange} /> GST enabled
                </label>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label>
                  <span className="mb-2 block text-sm font-medium text-slate-200">GSTIN</span>
                  <input name="gstConfigurationGstin" value={form.gstConfigurationGstin} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-medium text-slate-200">State code</span>
                  <input name="gstStateCode" value={form.gstStateCode} onChange={handleChange} placeholder="27" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-medium text-slate-200">State</span>
                  <input name="gstState" value={form.gstState} onChange={handleChange} placeholder="Maharashtra" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
                </label>
              </div>
              <div className="mt-4 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">
                E-invoice readiness checks are available on invoice details. Government submission and API secrets are intentionally not exposed here.
              </div>
            </div>
          </div>

          {saveError ? <p className="mt-4 text-sm text-rose-400">{saveError}</p> : null}

          <button
            type="submit"
            disabled={isSaving}
            className="mt-6 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Saving profile..." : "Save business profile"}
          </button>
        </form>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm font-semibold text-white">Communication providers</p>
            <p className="mt-2 text-sm text-slate-300">
              Payment reminders use BillStack's communication layer. WhatsApp sends only after native provider credentials are configured.
            </p>
            <div className="mt-4 grid gap-2 text-sm text-slate-300">
              <ProviderStatus label="WhatsApp Business API" configured={communicationSummary?.providerStatus?.whatsapp?.configured} />
              <ProviderStatus label="Email delivery" configured={communicationSummary?.providerStatus?.email?.configured} />
              <ProviderStatus label="SMS provider" configured={communicationSummary?.providerStatus?.sms?.configured} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">External Integration API</p>
                <p className="mt-2 text-sm text-slate-300">
                  Connect websites, CRMs, and future Nemnidhi flows without exposing internal admin APIs.
                </p>
              </div>
              <button type="button" onClick={handleCreateIntegrationKey} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200">Create key</button>
            </div>
            {newIntegrationKey ? (
              <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3">
                <p className="text-xs font-semibold text-emerald-200">Copy this key now. It will not be shown again.</p>
                <code className="mt-2 block break-all text-xs text-emerald-100">{newIntegrationKey}</code>
              </div>
            ) : null}
            {integrationError ? <p className="mt-3 text-sm text-rose-400">{integrationError}</p> : null}
            <div className="mt-4 space-y-2">
              {integrationCredentials.length ? integrationCredentials.map((credential) => (
                <div key={credential._id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm text-slate-300">
                  <span>{credential.name} · {credential.source} · {credential.keyPrefix}••••</span>
                  <button type="button" disabled={credential.status === "REVOKED"} onClick={() => handleRevokeIntegrationKey(credential._id)} className="text-xs text-rose-300 disabled:text-slate-500">
                    {credential.status === "REVOKED" ? "Revoked" : "Revoke"}
                  </button>
                </div>
              )) : <p className="text-sm text-slate-400">No integration keys yet.</p>}
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Recent integration events</p>
              {integrationEvents.length ? integrationEvents.map((event) => (
                <p key={event._id} className="mt-2 text-xs text-slate-400">{event.source} · {event.externalOrderId} · {event.status}</p>
              )) : <p className="mt-2 text-xs text-slate-500">No events yet.</p>}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm font-semibold text-white">Account security</p>
            <p className="mt-2 text-sm text-slate-300">
              Google login is linked server-side by verified email only. OAuth secrets are never exposed to the browser.
            </p>
            <p className="mt-3 text-sm text-slate-300">
              Google account: <span className="font-semibold text-white">{user?.authProvider?.includes("google") ? "Linked" : "Not linked yet"}</span>
            </p>
          </div>

          <ModulesPanel
            moduleData={moduleData}
            moduleError={moduleError}
            moduleMessage={moduleMessage}
            onRequest={handleModuleRequest}
            onState={handleModuleState}
            onAccept={handleAcceptOffer}
            onDecline={handleDeclineOffer}
            onRazorpay={handleRazorpayAddon}
            onManualUpi={handleManualUpi}
          />
        </div>
      </section>
    </div>
  );
};

const ProviderStatus = ({ label, configured }) => (
  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] px-3 py-2">
    <span>{label}</span>
    <span className={configured ? "text-emerald-300" : "text-amber-300"}>{configured ? "Configured" : "Not configured"}</span>
  </div>
);

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0));

const ModulesPanel = ({ moduleData, moduleError, moduleMessage, onRequest, onState, onAccept, onDecline, onRazorpay, onManualUpi }) => {
  const modules = moduleData?.catalog || [];
  const groups = {
    ACTIVE: modules.filter((item) => item.state === "ACTIVE"),
    AVAILABLE: modules.filter((item) => item.state === "AVAILABLE"),
    REQUEST: modules.filter((item) => item.state === "REQUEST_REQUIRED" || item.commercialState === "REQUESTED"),
    OFFERS: modules.filter((item) => ["OFFER_RECEIVED", "PAYMENT_PENDING"].includes(item.commercialState)),
    DISABLED: modules.filter((item) => item.state === "DISABLED"),
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div>
        <p className="text-sm font-semibold text-white">Modules & Add-ons</p>
        <p className="mt-2 text-sm text-slate-300">
          Deployment mode: <span className="font-semibold text-white">{moduleData?.deploymentMode || "SAAS"}</span>. Core financial modules are protected from accidental disablement.
        </p>
      </div>
      {moduleError ? <p className="mt-3 text-sm text-rose-300">{moduleError}</p> : null}
      {moduleMessage ? <p className="mt-3 text-sm text-emerald-300">{moduleMessage}</p> : null}
      <div className="mt-5 space-y-5">
        {Object.entries(groups).map(([group, items]) => (
          <section key={group}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{group}</p>
            <div className="mt-3 grid gap-3">
              {items.length ? items.map((item) => (
                <div key={item.key} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{item.description}</p>
                      {item.dependencies?.length ? <p className="mt-2 text-xs text-slate-500">Depends on: {item.dependencies.join(", ")}</p> : null}
                      {item.commercial ? (
                        <p className="mt-2 text-xs text-slate-400">
                          {item.commercial.commercialType.replace("_", " ")}
                          {item.commercial.defaultPrice > 0 ? ` · Standard ${formatMoney(item.commercial.defaultPrice)} + GST` : ""}
                        </p>
                      ) : null}
                      {item.latestOffer ? (
                        <div className="mt-3 rounded-xl border border-brand-400/20 bg-brand-500/10 p-3 text-xs text-slate-200">
                          <p className="font-semibold text-white">Offer: {formatMoney(item.latestOffer.finalAmount)} total</p>
                          <p className="mt-1">Base {formatMoney(item.latestOffer.subtotal)} · GST {formatMoney(item.latestOffer.taxAmount)} · Status {item.latestOffer.status}</p>
                        </div>
                      ) : null}
                      {item.latestOrder ? (
                        <p className="mt-2 text-xs text-amber-200">Payment: {item.latestOrder.paymentStatus} · Activation: {item.latestOrder.activationStatus}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {item.commercialState === "OFFER_RECEIVED" && item.latestOffer ? (
                        <>
                          <button type="button" onClick={() => onAccept(item.latestOffer._id)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Accept offer</button>
                          <button type="button" onClick={() => onDecline(item.latestOffer._id)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200">Decline</button>
                        </>
                      ) : null}
                      {item.commercialState === "PAYMENT_PENDING" && item.latestOffer ? (
                        <>
                          <button type="button" onClick={() => onRazorpay(item.latestOffer._id)} className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white">Pay online</button>
                          <button type="button" onClick={() => onManualUpi(item.latestOffer._id)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200">Manual UPI</button>
                        </>
                      ) : null}
                      {item.state === "ACTIVE" && !item.protected ? (
                        <button type="button" onClick={() => onState(item.key, "DISABLED")} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200">Disable</button>
                      ) : null}
                      {(item.state === "AVAILABLE" || item.state === "DISABLED") && !["OFFER_RECEIVED", "PAYMENT_PENDING"].includes(item.commercialState) ? (
                        <button type="button" onClick={() => onState(item.key, "ACTIVE")} className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white">Enable</button>
                      ) : null}
                      {item.state === "REQUEST_REQUIRED" && item.commercialState !== "REQUESTED" ? (
                        <button type="button" onClick={() => onRequest(item.key)} className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100">Request</button>
                      ) : null}
                      {item.commercialState === "REQUESTED" ? (
                        <span className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400">Requested</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )) : <p className="text-sm text-slate-500">No modules in this section.</p>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default BusinessSettingsPage;
