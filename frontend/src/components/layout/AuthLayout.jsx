import { Link, Outlet, useLocation } from "react-router-dom";

const AuthLayout = () => {
  const deploymentMode = import.meta.env.VITE_BILLSTACK_DEPLOYMENT_MODE || "SAAS";
  const { pathname } = useLocation();
  const isSelfHosted = deploymentMode === "SELF_HOSTED";
  const clientName = import.meta.env.VITE_CLIENT_DISPLAY_NAME || "THE OFFICE ON RENT";
  const productName = isSelfHosted ? clientName : "BillStack";
  const poweredByText = String(import.meta.env.VITE_POWERED_BY_TEXT || "NEMNIDHI")
    .replace(/^(?:Powered by )?Nemnidhi(?: Digital Solutions)?$/i, "NEMNIDHI");
  const isRegistration = pathname === "/register";

  return (
    <main className="auth-page flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <section className={`auth-card w-full rounded-3xl border p-6 shadow-xl sm:p-8 ${isRegistration ? "max-w-[760px]" : "max-w-[470px]"}`}>
        <header className="mb-6 text-center">
          <Link to="/" className="inline-flex max-w-full items-center justify-center" aria-label={`${productName} home`}>
            {isSelfHosted ? (
              <img src="/brand/toor-logo-web.png" alt="TOOR Rent" className="h-auto max-h-20 w-auto max-w-[250px] object-contain" />
            ) : (
              <span className="text-2xl font-bold text-slate-950 dark:text-white">BillStack</span>
            )}
          </Link>
          <h1 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">{productName}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Billing &amp; Business Management</p>
        </header>

        <Outlet />

        {isSelfHosted ? (
          <p className="mt-5 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
            Powered by <span className="font-semibold tracking-[0.12em]">{poweredByText}</span>
          </p>
        ) : null}
      </section>
    </main>
  );
};

export default AuthLayout;
