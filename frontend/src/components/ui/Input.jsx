import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const Input = ({ label, type = "text", placeholder, error, ...props }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <div className="relative">
        <input
          type={inputType}
          placeholder={placeholder}
          {...props}
          className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-950/60 dark:text-white dark:focus:border-brand-400 dark:focus:bg-slate-950 ${
            isPassword ? "pr-12" : ""
          }`}
        />
        {isPassword ? (
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-1 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {error ? <span className="mt-2 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
};

export default Input;
