import { Outlet, Link } from "react-router-dom";
import { CheckCircle2, FileText, ShieldCheck, WalletCards } from "lucide-react";

const AuthLayout = () => {
  const deploymentMode = import.meta.env.VITE_BILLSTACK_DEPLOYMENT_MODE || "SAAS";
  const poweredByText = String(import.meta.env.VITE_POWERED_BY_TEXT || "NEMNIDHI")
    .replace(/^(?:Powered by )?Nemnidhi(?: Digital Solutions)?$/i, "NEMNIDHI");
  const showPoweredBy = deploymentMode === "SELF_HOSTED" && poweredByText;
  const isSelfHosted = deploymentMode === "SELF_HOSTED";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 lg:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,0.14),transparent_34%),radial-gradient(circle_at_85%_85%,rgba(34,197,94,0.1),transparent_30%)]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-2xl shadow-slate-300/30 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-10 text-white lg:flex lg:min-h-[620px] lg:flex-col lg:justify-between xl:p-12">
          <div>
            {isSelfHosted ? <div className="inline-flex rounded-2xl bg-white px-4 py-3 shadow-lg shadow-black/20"><img src="/brand/toor-logo.png" alt="TOOR Rent" className="h-16 w-auto max-w-[260px] object-contain object-left" /></div> : <p className="text-sm font-bold uppercase tracking-[0.3em] text-sky-300">BillStack</p>}
            <h1 className="mt-8 max-w-md text-4xl font-semibold leading-[1.15]">
              Billing that keeps your business moving.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">Create professional invoices, track collections and stay on top of every client balance from one secure workspace.</p>
            <div className="mt-8 grid gap-3 text-sm text-slate-200">
              <AuthBenefit icon={FileText} text="Professional GST-ready invoices" />
              <AuthBenefit icon={WalletCards} text="Clear payment and expense tracking" />
              <AuthBenefit icon={ShieldCheck} text="Secure, private business workspace" />
            </div>
          </div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Simple · Reliable · Client ready</p>
        </section>

        <section className="flex min-h-[560px] flex-col justify-center p-6 sm:p-10 lg:p-12" style={{ background: "var(--panel-bg)" }}>
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link to="/" className="flex min-w-0 items-center gap-3" style={{ color: "var(--text-primary)" }}>
              {isSelfHosted ? <span className="rounded-xl bg-white px-3 py-2 lg:hidden"><img src="/brand/toor-logo.png" alt="TOOR Rent" className="h-10 w-auto max-w-[170px] object-contain object-left" /></span> : <span className="text-2xl font-bold">BillStack</span>}
            </Link>
            {showPoweredBy ? <span className="rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>{poweredByText}</span> : null}
          </div>
          <Outlet />
        </section>
      </div>
    </div>
  );
};

const AuthBenefit = ({ icon: Icon, text }) => (
  <div className="flex items-center gap-3">
    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-sky-300"><Icon size={16} /></span>
    <span>{text}</span>
    <CheckCircle2 size={15} className="ml-auto text-emerald-400" />
  </div>
);

export default AuthLayout;
