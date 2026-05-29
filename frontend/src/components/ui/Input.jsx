const Input = ({ label, type = "text", placeholder, error, ...props }) => {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        {...props}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:bg-white"
      />
      {error ? <span className="mt-2 block text-xs text-rose-600">{error}</span> : null}
    </label>
  );
};

export default Input;
