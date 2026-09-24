import { Link, Outlet } from "react-router-dom";

const AuthLayout = () => {
  const deploymentMode = import.meta.env.VITE_BILLSTACK_DEPLOYMENT_MODE || "SAAS";
  const isSelfHosted = deploymentMode === "SELF_HOSTED";
  const clientName = import.meta.env.VITE_CLIENT_DISPLAY_NAME || "THE OFFICE ON RENT";
  const productName = isSelfHosted ? clientName : "BillStack";
  const poweredByText = String(import.meta.env.VITE_POWERED_BY_TEXT || "NEMNIDHI")
    .replace(/^(?:Powered by )?Nemnidhi(?: Digital Solutions)?$/i, "NEMNIDHI");

  return (
    <main className="auth-page flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <section className="auth-card w-full max-w-[470px] rounded-3xl border p-6 shadow-xl sm:p-9">
        <header className="mb-8 text-center">
          <Link to="/" className="inline-flex max-w-full items-center justify-center" aria-label={`${productName} home`}>
            {isSelfHosted ? (
              <span className="client-logo-crop" role="img" aria-label="TOOR Rent">
                <img src="/brand/toor%20logo.png.png" alt="" aria-hidden="true" />
              </span>
            ) : (
              <span className="text-2xl font-bold text-slate-950 dark:text-white">BillStack</span>
            )}
          </Link>
          <h1 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">{productName}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Billing &amp; Business Management</p>
        </header>

        <Outlet />

        {isSelfHosted ? (
          <p className="mt-8 border-t border-slate-200 pt-5 text-center text-[11px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
            Powered by <span className="font-semibold tracking-[0.12em]">{poweredByText}</span>
          </p>
        ) : null}
      </section>
    </main>
  );
};

export default AuthLayout;
