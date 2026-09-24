import LoadingIndicator from "./LoadingIndicator";

const RouteFallback = ({ title = "Loading page", description = "Please wait while the next screen is prepared." }) => (
  <div className="flex min-h-[40vh] items-center justify-center px-4 py-10">
    <div className="w-full max-w-xl rounded-[2rem] border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-8 text-center shadow-sm">
      <LoadingIndicator label="" />
      <h2 className="mt-5 text-xl font-semibold text-[color:var(--text-primary)]">{title}</h2>
      <p className="mt-2 text-sm text-[color:var(--text-muted)]">{description}</p>
    </div>
  </div>
);

export default RouteFallback;
