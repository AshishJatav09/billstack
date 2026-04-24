export const LoadingState = ({ title = "Loading...", description = "Please wait while data loads." }) => (
  <div className="rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-8 text-center">
    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[color:var(--panel-border)] border-t-[color:var(--accent)]" />
    <h3 className="mt-4 text-lg font-semibold text-[color:var(--text-primary)]">{title}</h3>
    <p className="mt-2 text-sm text-[color:var(--text-muted)]">{description}</p>
  </div>
);

export const EmptyState = ({ title = "Nothing here yet", description = "Create your first record to get started." }) => (
  <div className="rounded-3xl border border-dashed border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-8 text-center">
    <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{title}</h3>
    <p className="mt-2 text-sm text-[color:var(--text-muted)]">{description}</p>
  </div>
);

export const ErrorState = ({ title = "Something went wrong", description = "Please try again." }) => (
  <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
    <h3 className="text-lg font-semibold text-rose-100">{title}</h3>
    <p className="mt-2 text-sm text-rose-200/90">{description}</p>
  </div>
);
