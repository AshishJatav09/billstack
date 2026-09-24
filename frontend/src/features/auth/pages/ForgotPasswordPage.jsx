import { useState } from "react";
import { Link } from "react-router-dom";
import AuthCard from "../../../components/ui/AuthCard";
import Input from "../../../components/ui/Input";
import LoadingIndicator from "../../../components/ui/LoadingIndicator";
import { forgotPasswordRequest } from "../api";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await forgotPasswordRequest({ email });
      setMessage(response.message || "If an account exists for this email, a reset link has been sent.");
    } catch (requestError) {
      setError(requestError.response?.data?.errors?.email || requestError.response?.data?.message || "Unable to send reset link");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Reset password"
      subtitle="Enter your registered email and we’ll send you a reset link."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Email"
          type="email"
          placeholder="you@business.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={error}
          autoComplete="email"
          required
        />
        {message ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700">{message}</p> : null}
        <button
          className="auth-primary w-full rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-70"
          disabled={isSubmitting}
        >
          {isSubmitting ? <LoadingIndicator compact label="Sending..." className="text-white [&>svg]:text-white" /> : "Send reset link"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-500">
        Remembered it?{" "}
        <Link to="/login" className="font-medium text-brand-700">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
};

export default ForgotPasswordPage;
