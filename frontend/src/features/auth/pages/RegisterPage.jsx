import { useState } from "react";
import { Link } from "react-router-dom";
import AuthCard from "../../../components/ui/AuthCard";
import FormField from "../../../components/ui/FormField";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { useAuth } from "../useAuth";

const initialForm = {
  name: "",
  email: "",
  password: "",
  businessName: "",
};

const RegisterPage = () => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { googleAuth, register } = useAuth();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleGoogle = async (payload) => {
    setServerError("");
    setErrors({});
    if (!form.businessName.trim()) {
      setErrors({ businessName: "Business name is required for Google signup." });
      return;
    }
    setIsSubmitting(true);
    try {
      await googleAuth({ ...payload, mode: "signup", businessName: form.businessName, name: form.name });
    } catch (error) {
      setServerError(error.response?.data?.message || "Google signup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setServerError("");
    setIsSubmitting(true);

    try {
      await register(form);
    } catch (error) {
      setErrors(error.response?.data?.errors || {});
      setServerError(error.response?.data?.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Create your workspace"
      subtitle="Create a tenant-safe business and its owner account in one step."
    >
      <div className="mb-4">
        <FormField label="Business name for Google signup" name="businessName" placeholder="BillStack Labs" value={form.businessName} onChange={handleChange} error={errors.businessName} />
      </div>
      <GoogleAuthButton mode="signup" businessName={form.businessName} name={form.name} onSuccess={handleGoogle} onError={setServerError} />
      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400"><span className="h-px flex-1 bg-slate-200" />or create with email<span className="h-px flex-1 bg-slate-200" /></div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField label="Full name" name="name" placeholder="Aarav Sharma" value={form.name} onChange={handleChange} error={errors.name} />
        <FormField label="Work email" name="email" type="email" placeholder="team@billstack.app" value={form.email} onChange={handleChange} error={errors.email} />
        <FormField label="Password" name="password" type="password" placeholder="Create a secure password" value={form.password} onChange={handleChange} error={errors.password} />
        {serverError ? <p className="text-sm text-rose-600">{serverError}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Creating workspace..." : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-brand-700">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
};

export default RegisterPage;
