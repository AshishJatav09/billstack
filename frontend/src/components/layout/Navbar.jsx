import { useAuth } from "../../features/auth/useAuth";
import { uiStore } from "../../store/uiStore";

const Navbar = () => {
  const { business, logout, user } = useAuth();
  const { openSidebar, theme, toggleTheme } = uiStore();

  return (
    <header className="border-b border-white/10 bg-slate-950/80 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={openSidebar}
            className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-200 lg:hidden"
          >
            Menu
          </button>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Workspace</p>
          <h1 className="text-xl font-semibold text-white">
            {business?.name || "Billing Command Center"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {user?.role ? `${user.role} access` : "Secure tenant session"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 sm:block">
            {user?.email}
          </div>
          <button
            onClick={logout}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
