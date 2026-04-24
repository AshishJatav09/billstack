import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateBusinessSetupRequest } from "../api";
import { authStore } from "../../../store/authStore";

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { business, updateBusiness } = authStore();
  const [form, setForm] = useState({
    name: business?.name || "",
    industry: business?.industry || "",
    billingEmail: business?.billingEmail || "",
    email: business?.email || "",
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
    allowNegativeStock: business?.inventorySettings?.allowNegativeStock || false,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const handleFileChange = (event) => {
    setLogoFile(event.target.files?.[0] || null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setServerError("");
    setIsSubmitting(true);

    try {
      const payload = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        payload.append(key, value ?? "");
      });

      if (logoFile) {
        payload.append("logo", logoFile);
      }

      const data = await updateBusinessSetupRequest(payload);
      updateBusiness(data);
      navigate("/dashboard");
    } catch (error) {
      setErrors(error.response?.data?.errors || {});
      setServerError(error.response?.data?.message || "Unable to update business");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-panel sm:p-8">
        <p className="text-sm uppercase tracking-[0.35em] text-brand-300">Onboarding</p>
        <h1 className="mt-4 text-3xl font-semibold">Finish your business setup</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
          This updates only your current business record. Tenant isolation is enforced on every request.
        </p>

        <form className="mt-8 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-200">Business name</span>
            <input name="name" value={form.name} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
            {errors.name ? <span className="mt-2 block text-xs text-rose-400">{errors.name}</span> : null}
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Business email</span>
            <input name="email" value={form.email} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
            {errors.email ? <span className="mt-2 block text-xs text-rose-400">{errors.email}</span> : null}
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Industry</span>
            <input name="industry" value={form.industry} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Billing email</span>
            <input name="billingEmail" value={form.billingEmail} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
            {errors.billingEmail ? <span className="mt-2 block text-xs text-rose-400">{errors.billingEmail}</span> : null}
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Phone</span>
            <input name="phone" value={form.phone} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Address</span>
            <input name="address" value={form.address} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">GST / Tax ID</span>
            <input name="gstTaxId" value={form.gstTaxId} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Logo</span>
            <input type="file" accept="image/*" onChange={handleFileChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none file:mr-4 file:rounded-full file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-white" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Tax name</span>
            <input name="taxName" value={form.taxName} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Default tax rate</span>
            <input name="taxRate" value={form.taxRate} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
            {errors.taxRate ? <span className="mt-2 block text-xs text-rose-400">{errors.taxRate}</span> : null}
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Tax mode</span>
            <select name="taxMode" value={form.taxMode} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500">
              <option value="exclusive">Exclusive</option>
              <option value="inclusive">Inclusive</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Invoice prefix</span>
            <input name="invoicePrefix" value={form.invoicePrefix} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-200">Invoice numbering format</span>
            <input name="invoiceNumberingFormat" value={form.invoiceNumberingFormat} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-200">Invoice terms</span>
            <textarea name="invoiceTerms" value={form.invoiceTerms} onChange={handleChange} rows="4" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Bank account name</span>
            <input name="bankAccountName" value={form.bankAccountName} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Bank name</span>
            <input name="bankName" value={form.bankName} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">Account number</span>
            <input name="bankAccountNumber" value={form.bankAccountNumber} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-200">IFSC code</span>
            <input name="bankIfscCode" value={form.bankIfscCode} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-200">UPI ID</span>
            <input name="bankUpiId" value={form.bankUpiId} onChange={handleChange} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand-500" />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 md:col-span-2">
            <input type="checkbox" name="allowNegativeStock" checked={form.allowNegativeStock} onChange={handleChange} />
            Allow negative stock for this business
          </label>
          {serverError ? <p className="text-sm text-rose-400 md:col-span-2">{serverError}</p> : null}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Saving..." : "Complete setup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OnboardingPage;
