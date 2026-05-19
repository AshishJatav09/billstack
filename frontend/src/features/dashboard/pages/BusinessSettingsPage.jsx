import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  changeSubscriptionPlanRequest,
  createSubscriptionRequest,
  currentPlanRequest,
  currentSubscriptionRequest,
  listPlansRequest,
  updateBusinessSetupRequest,
} from "../../auth/api";
import { authStore } from "../../../store/authStore";

const getApiOrigin = () => {
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
  return apiBase.replace(/\/api$/, "");
};

const planRank = {
  free: 0,
  basic: 1,
  pro: 2,
  enterprise: 3,
};

let razorpayScriptPromise = null;

const ensureRazorpayCheckout = () => {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  return razorpayScriptPromise;
};

const BusinessSettingsPage = () => {
  const { business, updateBusiness, user } = authStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [subscriptionState, setSubscriptionState] = useState(business?.subscription || null);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [selectedPlanCode, setSelectedPlanCode] = useState(business?.planCode || "free");
  const [isPlanSaving, setIsPlanSaving] = useState(false);
  const [planError, setPlanError] = useState("");
  const [planSuccess, setPlanSuccess] = useState("");
  const [form, setForm] = useState({
    name: business?.name || "",
    email: business?.email || "",
    billingEmail: business?.billingEmail || "",
    phone: business?.phone || "",
    address: business?.address || "",
    gstTaxId: business?.gstTaxId || "",
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

  useEffect(() => {
    const loadPlanData = async () => {
      setIsLoadingPlans(true);

      try {
        const [availablePlans, activePlan] = await Promise.all([
          listPlansRequest(),
          currentPlanRequest(),
        ]);

        setPlans(availablePlans);
        setCurrentPlan(activePlan);
        setSelectedPlanCode(activePlan.subscription?.pendingPlanCode || activePlan.planCode);
        setSubscriptionState(activePlan.subscription);
      } catch (error) {
        setPlanError(error.response?.data?.message || "Unable to load plan data");
      } finally {
        setIsLoadingPlans(false);
      }
    };

    loadPlanData();
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const billingStatus = searchParams.get("billing");
    const billingMessage = searchParams.get("message");

    if (!billingStatus) {
      return;
    }

    const consumeCallbackState = async () => {
      if (billingStatus === "success") {
        setPlanSuccess("Payment verified successfully. Your subscription is now active.");
        setPlanError("");

        try {
          await refreshSubscriptionState();
        } catch (error) {
          setPlanError(error.response?.data?.message || "Unable to refresh subscription");
        }
      } else {
        setPlanSuccess("");
        setPlanError(billingMessage || "Razorpay payment could not be verified.");
      }

      navigate(location.pathname, { replace: true });
    };

    consumeCallbackState();
  }, [location.pathname, location.search, navigate]);

  const logoPreviewUrl = useMemo(() => {
    if (logoFile) {
      return URL.createObjectURL(logoFile);
    }

    if (business?.logoUrl) {
      return `${getApiOrigin()}${business.logoUrl}`;
    }

    return "";
  }, [business?.logoUrl, logoFile]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const handleLogoChange = (event) => {
    setLogoFile(event.target.files?.[0] || null);
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveError("");
    setFieldErrors({});

    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value ?? ""));

      if (logoFile) {
        payload.append("logo", logoFile);
      }

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

  const handlePlanSubmit = async () => {
    setIsPlanSaving(true);
    setPlanError("");
    setPlanSuccess("");

    try {
      let data;

      if (selectedPlanCode === "free") {
        data = await changeSubscriptionPlanRequest({
          planCode: "free",
          scheduleChangeAt: "now",
        });
        setPlanSuccess("Downgraded to Free plan.");
      } else if (!subscriptionState?.razorpaySubscriptionId || business?.planCode === "free") {
        const subscriptionData = await createSubscriptionRequest({
          planCode: selectedPlanCode,
          totalCount: 12,
          quantity: 1,
        });
        data = subscriptionData.business;
        setPlanSuccess("Opening Razorpay checkout to authorize your subscription.");

        const hasCheckout = await ensureRazorpayCheckout();

        if (hasCheckout && subscriptionData.subscriptionId && subscriptionData.razorpayKeyId) {
          const checkout = new window.Razorpay({
            key: subscriptionData.razorpayKeyId,
            subscription_id: subscriptionData.subscriptionId,
            name: "BillStack",
            description: `Activate ${selectedPlanCode} plan`,
            callback_url: `${getApiOrigin()}/api/billing/subscription/callback`,
            redirect: true,
            prefill: {
              name: business?.name || "",
              email: business?.billingEmail || business?.email || "",
              contact: business?.phone || "",
            },
            notes: {
              businessId: business?.id || "",
              businessName: business?.name || "",
              targetPlanCode: selectedPlanCode,
            },
            modal: {
              ondismiss: () => {
                setPlanSuccess("Checkout closed. You can retry plan activation anytime.");
              },
            },
            theme: {
              color: "#3B82F6",
            },
          });

          checkout.open();
        } else if (subscriptionData.shortUrl) {
          window.location.href = subscriptionData.shortUrl;
        } else {
          throw new Error("Unable to open Razorpay checkout");
        }
      } else {
        data = await changeSubscriptionPlanRequest({
          planCode: selectedPlanCode,
          scheduleChangeAt:
            (planRank[selectedPlanCode] || 0) > (planRank[business?.planCode] || 0)
              ? "now"
              : "cycle_end",
        });
        setPlanSuccess("Subscription change scheduled successfully.");
      }

      updateBusiness(data);
      setCurrentPlan({
        planCode: data.planCode,
        plan: data.plan,
        invoiceUsage: data.invoiceUsage,
      });
      setSubscriptionState(data.subscription);
      setSelectedPlanCode(data.subscription?.pendingPlanCode || data.planCode);
    } catch (error) {
      setPlanError(error.response?.data?.message || "Unable to update plan");
    } finally {
      setIsPlanSaving(false);
    }
  };

  const refreshSubscriptionState = async () => {
    try {
      const data = await currentSubscriptionRequest();
      updateBusiness(data);
      setCurrentPlan({
        planCode: data.planCode,
        plan: data.plan,
        invoiceUsage: data.invoiceUsage,
      });
      setSubscriptionState(data.subscription);
      setSelectedPlanCode(data.subscription?.pendingPlanCode || data.planCode);
    } catch (error) {
      setPlanError(error.response?.data?.message || "Unable to refresh subscription");
    }
  };

  return (
    <div className="space-y-6">
      <section className="theme-hero rounded-[2rem] p-6 sm:p-8">
        <p className="theme-hero-kicker text-sm uppercase tracking-[0.3em]">Business Settings</p>
        <h2 className="theme-hero-title mt-3 text-3xl font-semibold">Profile, billing defaults, and plan control</h2>
        <p className="theme-hero-copy mt-3 max-w-3xl text-sm">
          Only your current business is editable here. Owner and admin access is enforced on the
          backend, and plan guards decide which features open up across the product.
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
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-sm text-slate-300">
                Logo
              </div>
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
                onChange={handleLogoChange}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-white"
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 md:col-span-2">
              <input
                type="checkbox"
                name="allowNegativeStock"
                checked={form.allowNegativeStock}
                onChange={handleChange}
              />
              Allow negative stock when recording stock out
            </label>
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

        <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div>
            <h3 className="text-xl font-semibold text-white">SaaS Plan</h3>
            <p className="mt-2 text-sm text-slate-400">
              Free plan is capped at 20 invoices per month. Feature guard middleware enforces access.
            </p>
          </div>

          {isLoadingPlans ? (
            <p className="text-sm text-slate-400">Loading plans...</p>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => (
                <label
                  key={plan.code}
                  className={`block rounded-2xl border p-4 ${
                    selectedPlanCode === plan.code
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-white/10 bg-slate-950/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{plan.name}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {plan.invoiceMonthlyLimit === Number.MAX_SAFE_INTEGER
                          ? "Unlimited invoices"
                          : `${plan.invoiceMonthlyLimit} invoices / month`}
                      </p>
                    </div>
                    <input
                      type="radio"
                      name="planCode"
                      checked={selectedPlanCode === plan.code}
                      onChange={() => setSelectedPlanCode(plan.code)}
                    />
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-300">
                    <span>Staff users: {plan.staffUserLimit}</span>
                    <span>Inventory: {plan.inventoryAccess ? "Yes" : "No"}</span>
                    <span>Reports: {plan.reportsAccess ? "Yes" : "No"}</span>
                    <span>PDF templates: {plan.pdfTemplatesAccess ? "Yes" : "No"}</span>
                    <span>Sharing: {plan.sharingAccess ? "Yes" : "No"}</span>
                  </div>
                </label>
              ))}
            </div>
          )}

          {currentPlan ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
              <p>Current plan: <span className="font-semibold text-white">{currentPlan.plan.name}</span></p>
              <p className="mt-2">
                Current month usage: {currentPlan.invoiceUsage?.count || 0}
                {currentPlan.plan.invoiceMonthlyLimit === Number.MAX_SAFE_INTEGER
                  ? " / unlimited"
                  : ` / ${currentPlan.plan.invoiceMonthlyLimit}`}
              </p>
              <p className="mt-2">Subscription status: <span className="font-semibold text-white">{subscriptionState?.status || "inactive"}</span></p>
              <p className="mt-2">Access: <span className="font-semibold text-white">{subscriptionState?.isAccessible ? "Active" : subscriptionState?.isExpired ? "Expired" : "Restricted"}</span></p>
              {subscriptionState?.currentEnd ? (
                <p className="mt-2">Expires: {new Date(subscriptionState.currentEnd).toLocaleString()}</p>
              ) : null}
              {subscriptionState?.shortUrl ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => window.open(subscriptionState.shortUrl, "_blank")}
                    className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200"
                  >
                    Open hosted checkout
                  </button>
                  <button
                    type="button"
                    onClick={refreshSubscriptionState}
                    className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200"
                  >
                    Refresh billing status
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {planError ? <p className="text-sm text-rose-400">{planError}</p> : null}
          {planSuccess ? <p className="text-sm text-emerald-300">{planSuccess}</p> : null}

          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <p className="text-sm font-semibold text-white">Automatic billing verification</p>
            <p className="mt-3 text-sm text-slate-300">
              After Razorpay payment or mandate authorization succeeds, BillStack now verifies the
              signature on the backend callback and refreshes your subscription automatically when
              you return here. You should not need to paste Razorpay IDs manually anymore.
            </p>
            <button
              type="button"
              onClick={refreshSubscriptionState}
              className="mt-3 rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-200"
            >
              Refresh billing status
            </button>
          </div>

          <button
            type="button"
            disabled={isPlanSaving || user?.role !== "owner"}
            onClick={handlePlanSubmit}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPlanSaving ? "Processing..." : user?.role === "owner" ? "Change subscription plan" : "Owner only"}
          </button>
        </div>
      </section>
    </div>
  );
};

export default BusinessSettingsPage;
