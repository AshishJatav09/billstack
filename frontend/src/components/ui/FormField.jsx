const FormField = ({
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
}) => {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${
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
      {error ? <span className="mt-2 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
};

export default FormField;
