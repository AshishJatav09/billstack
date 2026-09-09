import { Outlet, Link } from "react-router-dom";

const AuthLayout = () => {
  const deploymentMode = import.meta.env.VITE_BILLSTACK_DEPLOYMENT_MODE || "SAAS";
  const poweredByText = import.meta.env.VITE_POWERED_BY_TEXT || "Powered by Nemnidhi Digital Solutions";
  const showPoweredBy = deploymentMode === "SELF_HOSTED" && poweredByText;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-panel lg:grid-cols-[0.95fr_1.05fr]">
        <section className="hidden bg-slate-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-brand-300">BillStack</p>
            <h1 className="mt-6 max-w-sm text-4xl font-semibold leading-tight">
              Sign in to your billing workspace.
            </h1>
          </div>
          <div className="text-sm leading-6 text-slate-300">
            Manage invoices, payments, GST, subscriptions, and business operations from one secure place.
          </div>
        </section>

        <section className="p-6 sm:p-10" style={{ background: "var(--panel-bg)" }}>
          <div className="mb-8 flex items-center">
            <Link to="/" className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              BillStack
            </Link>
          </div>
          <Outlet />
          {showPoweredBy ? (
            <p className="mt-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>
              {poweredByText}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default AuthLayout;
