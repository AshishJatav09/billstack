import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const FormField = ({
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</span>
      <div className="relative">
        <input
          name={name}
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${
            isPassword ? "pr-12" : ""
          } ${
            error
              ? "border-rose-300 bg-rose-50 text-slate-950"
              : "focus:border-brand-500"
          }`}
          style={
            error
              ? undefined
              : {
                  borderColor: "var(--panel-border)",
                  background: "rgba(148, 163, 184, 0.12)",
                  color: "var(--text-primary)",
                }
          }
        />
        {isPassword ? (
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-full p-1 text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {error ? <span className="mt-2 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
};

export default FormField;
