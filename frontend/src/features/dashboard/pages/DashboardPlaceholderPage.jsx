const DashboardPlaceholderPage = ({ title, description }) => {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8">
      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Coming next</p>
      <h2 className="mt-3 text-3xl font-semibold text-white">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm text-slate-300">{description}</p>
    </div>
  );
};

export default DashboardPlaceholderPage;

