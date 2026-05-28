import { useState } from "react";
import { Link } from "react-router-dom";
import AuthCard from "../../../components/ui/AuthCard";
import FormField from "../../../components/ui/FormField";
import { useAuth } from "../useAuth";

const initialForm = {
  email: "",
  password: "",
};

const LoginPage = () => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

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
      await login(form);
    } catch (error) {
      setErrors(error.response?.data?.errors || {});
      setServerError(error.response?.data?.message || "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue to your workspace."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField label="Email" name="email" type="email" placeholder="founder@billstack.app" value={form.email} onChange={handleChange} error={errors.email} />
        <FormField label="Password" name="password" type="password" placeholder="Enter your password" value={form.password} onChange={handleChange} error={errors.password} />
        {serverError ? <p className="text-sm text-rose-600">{serverError}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <div className="mt-4 flex items-center justify-between text-sm">
        <Link to="/forgot-password" className="text-brand-700">
          Forgot password?
        </Link>
        <Link to="/register" className="text-slate-500">
          Create account
        </Link>
      </div>
    </AuthCard>
  );
};

export default LoginPage;
