import { useState } from "react";
import { Link } from "react-router-dom";
import AuthCard from "../../../components/ui/AuthCard";
import FormField from "../../../components/ui/FormField";
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
  const { register } = useAuth();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
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
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField label="Full name" name="name" placeholder="Aarav Sharma" value={form.name} onChange={handleChange} error={errors.name} />
        <FormField label="Work email" name="email" type="email" placeholder="team@billstack.app" value={form.email} onChange={handleChange} error={errors.email} />
        <FormField label="Password" name="password" type="password" placeholder="Create a secure password" value={form.password} onChange={handleChange} error={errors.password} />
        <FormField label="Business name" name="businessName" placeholder="BillStack Labs" value={form.businessName} onChange={handleChange} error={errors.businessName} />
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
