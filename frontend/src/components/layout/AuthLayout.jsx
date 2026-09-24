import { Outlet, Link } from "react-router-dom";
import { CheckCircle2, FileText, ShieldCheck, WalletCards } from "lucide-react";

const AuthLayout = () => {
  const deploymentMode = import.meta.env.VITE_BILLSTACK_DEPLOYMENT_MODE || "SAAS";
  const poweredByText = String(import.meta.env.VITE_POWERED_BY_TEXT || "NEMNIDHI")
    .replace(/^(?:Powered by )?Nemnidhi(?: Digital Solutions)?$/i, "NEMNIDHI");
  const isSelfHosted = deploymentMode === "SELF_HOSTED";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 lg:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,0.14),transparent_34%),radial-gradient(circle_at_85%_85%,rgba(34,197,94,0.1),transparent_30%)]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-2xl shadow-slate-300/30 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="auth-hero hidden p-10 lg:flex lg:min-h-[620px] lg:flex-col lg:justify-between xl:p-12">
          <div>
            <p className="auth-kicker text-sm font-bold uppercase tracking-[0.3em]">{isSelfHosted ? "Client billing workspace" : "BillStack"}</p>
            <h1 className="auth-title mt-7 max-w-md text-4xl font-semibold leading-[1.15]">Simple billing.<br />Clear business.</h1>
            <p className="auth-copy mt-5 max-w-md text-sm leading-6">Create invoices, record payments and understand every client balance without unnecessary complexity.</p>
            <div className="auth-benefits mt-9 grid gap-4 text-sm">
              <AuthBenefit icon={FileText} text="Professional GST-ready invoices" />
              <AuthBenefit icon={WalletCards} text="Clear payment and expense tracking" />
              <AuthBenefit icon={ShieldCheck} text="Secure, private business workspace" />
            </div>
          </div>
          <p className="auth-copy text-xs uppercase tracking-[0.24em]">Secure · Reliable · Client ready</p>
        </section>

        <section className="flex min-h-[560px] flex-col justify-center p-6 sm:p-10 lg:p-12" style={{ background: "var(--panel-bg)" }}>
          <div className="mb-9 flex items-center">
            <Link to="/" className="flex min-w-0 items-center" style={{ color: "var(--text-primary)" }}>
              {isSelfHosted ? <span className="inline-flex rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200"><img src="/brand/toor-logo.png" alt="TOOR Rent" className="h-12 w-auto max-w-[200px] object-contain object-left" /></span> : <span className="text-2xl font-bold">BillStack</span>}
            </Link>
          </div>
          <Outlet />
          {isSelfHosted ? <p className="mt-8 text-center text-[10px] font-bold tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>{poweredByText}</p> : null}
        </section>
      </div>
    </div>
  );
};

const AuthBenefit = ({ icon: Icon, text }) => (
  <div className="flex items-center gap-3">
    <span className="auth-benefit-icon flex h-8 w-8 items-center justify-center rounded-xl"><Icon size={16} /></span>
    <span>{text}</span>
    <CheckCircle2 size={15} className="auth-check ml-auto" />
  </div>
);

export default AuthLayout;
