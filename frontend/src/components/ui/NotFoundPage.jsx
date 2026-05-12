import { Link } from "react-router-dom";

const NotFoundPage = () => (
  <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
    <div className="w-full max-w-2xl rounded-[2rem] border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-400">404</p>
      <h1 className="mt-4 text-4xl font-semibold text-[color:var(--text-primary)]">This page does not exist</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-[color:var(--text-muted)]">
        The link may be old, mistyped, or the page may have moved. You can head back to the
        dashboard or sign in again.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/dashboard"
          className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Open dashboard
        </Link>
        <Link
          to="/login"
          className="rounded-2xl border border-[color:var(--panel-border)] px-5 py-3 text-sm font-semibold text-[color:var(--text-primary)]"
        >
          Go to login
        </Link>
      </div>
    </div>
  </div>
);

export default NotFoundPage;
