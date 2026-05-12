import { useAuth } from "../../features/auth/useAuth";
import { uiStore } from "../../store/uiStore";

const Navbar = () => {
  const { business, logout, user } = useAuth();
  const { openSidebar, theme, toggleTheme } = uiStore();

  return (
    <header
      className="px-4 py-4 backdrop-blur sm:px-6 lg:px-8"
      style={{
        borderBottom: "1px solid var(--panel-border)",
        background: "color-mix(in srgb, var(--panel-bg) 88%, transparent)",
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={openSidebar}
            className="mb-3 inline-flex rounded-full px-3 py-2 text-xs uppercase tracking-[0.2em] lg:hidden"
            style={{
              border: "1px solid var(--panel-border)",
              background: "color-mix(in srgb, var(--panel-bg) 92%, transparent)",
              color: "var(--text-primary)",
            }}
          >
            Menu
          </button>
          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>Workspace</p>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {business?.name || "Billing Command Center"}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {user?.role ? `${user.role} access` : "Secure tenant session"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full px-4 py-2 text-sm"
            style={{
              border: "1px solid var(--panel-border)",
              background: "color-mix(in srgb, var(--panel-bg) 92%, transparent)",
              color: "var(--text-primary)",
            }}
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div
            className="hidden rounded-full px-4 py-2 text-sm sm:block"
            style={{
              border: "1px solid var(--panel-border)",
              background: "color-mix(in srgb, var(--panel-bg) 92%, transparent)",
              color: "var(--text-primary)",
            }}
          >
            {user?.email}
          </div>
          <button
            onClick={logout}
            className="rounded-full px-4 py-2 text-sm"
            style={{
              border: "1px solid var(--panel-border)",
              background: "color-mix(in srgb, var(--panel-bg) 92%, transparent)",
              color: "var(--text-primary)",
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
