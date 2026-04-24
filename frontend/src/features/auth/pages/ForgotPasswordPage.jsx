import { Link } from "react-router-dom";
import AuthCard from "../../../components/ui/AuthCard";
import Input from "../../../components/ui/Input";

const ForgotPasswordPage = () => {
  return (
    <AuthCard
      title="Reset password"
      subtitle="We will send a password reset link to your registered email."
    >
      <form className="space-y-4">
        <Input label="Email" type="email" placeholder="owner@billstack.app" />
        <button className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
          Send reset link
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

