import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

const RouteErrorPage = () => {
  const error = useRouteError();

  let title = "Something went wrong";
  let description = "The page could not be loaded right now. Try refreshing or go back to the dashboard.";
  let statusLabel = "Application error";

  if (isRouteErrorResponse(error)) {
    statusLabel = `${error.status}`;
    title = error.status === 404 ? "Page not found" : error.statusText || title;
    description = error.data?.message || description;
  } else if (error instanceof Error) {
    description = error.message || description;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-[2rem] border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-400">{statusLabel}</p>
        <h1 className="mt-4 text-4xl font-semibold text-[color:var(--text-primary)]">{title}</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-[color:var(--text-muted)]">{description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/dashboard"
            className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Go to dashboard
          </Link>
          <Link
            to="/login"
            className="rounded-2xl border border-[color:var(--panel-border)] px-5 py-3 text-sm font-semibold text-[color:var(--text-primary)]"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RouteErrorPage;
