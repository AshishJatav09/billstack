import { useState } from "react";
import { Link } from "react-router-dom";
import AuthCard from "../../../components/ui/AuthCard";
import Input from "../../../components/ui/Input";
import { forgotPasswordRequest } from "../api";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
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
      subtitle="We will send a password reset link to your registered email."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Email"
          type="email"
          placeholder="owner@billstack.app"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={error}
          required
        />
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <button
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-500">
        Remembered it?{" "}
        <Link to="/login" className="font-medium text-brand-700">
          Back to login
        </Link>
      </p>
    </AuthCard>
  );
};

export default ForgotPasswordPage;
