import { useState } from "react";
import { Link } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import AuthCard from "../../../components/ui/AuthCard";
import FormField from "../../../components/ui/FormField";
import GoogleAuthButton from "../components/GoogleAuthButton";
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
  const { googleAuth, login } = useAuth();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleGoogle = async (payload) => {
    if (isSubmitting) return;
    setServerError("");
    setErrors({});
    setIsSubmitting(true);
    try {
      await googleAuth(payload);
    } catch (error) {
      setServerError(error.response?.data?.message || "Google login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
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
      title="Sign in"
      subtitle="Welcome back. Sign in to continue to your workspace."
    >
      {googleClientId ? (
        <>
          <GoogleAuthButton mode="login" onSuccess={handleGoogle} onError={setServerError} />
          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400"><span className="h-px flex-1 bg-slate-200" />or continue with email<span className="h-px flex-1 bg-slate-200" /></div>
        </>
      ) : null}
      {serverError ? <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{serverError}</div> : null}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField label="Email" name="email" type="email" placeholder="you@business.com" value={form.email} onChange={handleChange} error={errors.email} autoComplete="username" required />
        <FormField label="Password" name="password" type="password" placeholder="Enter your password" value={form.password} onChange={handleChange} error={errors.password} autoComplete="current-password" required />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-700 dark:text-brand-300">Forgot password?</Link>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="auth-primary w-full rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? <span className="inline-flex items-center justify-center gap-2"><LoaderCircle size={17} className="animate-spin" />Signing in...</span> : "Sign in"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">New here? <Link to="/register" className="font-medium text-brand-700 dark:text-brand-300">Create account</Link></p>
    </AuthCard>
  );
};

export default LoginPage;
