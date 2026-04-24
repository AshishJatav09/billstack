import { Outlet, Link } from "react-router-dom";

const AuthLayout = () => {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-panel lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden bg-slate-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-brand-300">BillStack</p>
            <h1 className="mt-6 max-w-sm text-4xl font-semibold leading-tight">
              Run billing, teams, and tenant operations from one clean workspace.
            </h1>
          </div>
          <div className="space-y-3 text-sm text-slate-300">
            <p>Multi-tenant architecture ready</p>
            <p>Dashboard-first UI foundation</p>
            <p>Auth and API plumbing included</p>
          </div>
        </section>

        <section className="p-6 sm:p-10" style={{ background: "var(--panel-bg)" }}>
          <div className="mb-8 flex items-center justify-between">
            <Link to="/" className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              BillStack
            </Link>
            <Link to="/dashboard" className="text-sm font-medium text-brand-700">
              View demo
            </Link>
          </div>
          <Outlet />
        </section>
      </div>
    </div>
  );
};

export default AuthLayout;
