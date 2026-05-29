import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthCard from "../../../components/ui/AuthCard";
import Input from "../../../components/ui/Input";
import { resetPasswordRequest } from "../api";

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = searchParams.get("token") || "";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await resetPasswordRequest({ token, password });
      setMessage(response.message || "Password reset successfully. Please sign in.");
      setPassword("");
      setConfirmPassword("");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to reset password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard title="Create new password" subtitle="Enter a new password for your BillStack account.">
      {!token ? (
        <p className="text-sm text-rose-600">Password reset link is missing or invalid.</p>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="New password"
            type="password"
            placeholder="Create a new password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
          <Input
            label="Confirm password"
            type="password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            error={error}
            required
            minLength={6}
          />
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          <button
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Reset password"}
          </button>
        </form>
      )}
      <p className="mt-4 text-sm text-slate-500">
        Ready to sign in?{" "}
        <Link to="/login" className="font-medium text-brand-700">
          Back to login
        </Link>
      </p>
    </AuthCard>
  );
};

export default ResetPasswordPage;
