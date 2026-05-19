import { NavLink } from "react-router-dom";
import { authStore } from "../../store/authStore";
import { uiStore } from "../../store/uiStore";

const navItems = [
  { label: "Overview", to: "/dashboard" },
  { label: "Invoices", to: "/dashboard/invoices" },
  { label: "Customers", to: "/dashboard/customers" },
  { label: "Products", to: "/dashboard/products" },
  { label: "Suppliers", to: "/dashboard/suppliers" },
  { label: "Purchases", to: "/dashboard/purchases" },
  { label: "Reports", to: "/dashboard/reports" },
  { label: "Team", to: "/dashboard/team" },
  { label: "Settings", to: "/dashboard/settings" },
];

const Sidebar = () => {
  const { business } = authStore();
  const { closeSidebar, isSidebarOpen } = uiStore();

  return (
    <>
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeSidebar}
          className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col overflow-y-auto overscroll-contain px-6 py-8 transition-transform duration-200 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}
        style={{
          borderRight: "1px solid var(--panel-border)",
          background: "color-mix(in srgb, var(--panel-bg) 96%, transparent)",
          color: "var(--text-primary)",
        }}
      >
        <div className="mb-10 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-brand-300">BillStack</p>
            <h2 className="mt-3 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>{business?.slug || "saas-starter"}</h2>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              {business?.plan?.name || "Free"} plan. Every request stays isolated to this business.
            </p>
          </div>
          <button
            type="button"
            onClick={closeSidebar}
            className="rounded-full px-3 py-2 text-xs uppercase tracking-[0.2em] lg:hidden"
            style={{
              border: "1px solid var(--panel-border)",
              color: "var(--text-muted)",
            }}
          >
            Close
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto pb-6 pr-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              onClick={closeSidebar}
              className="block rounded-2xl border px-4 py-3 text-sm font-medium transition"
              style={({ isActive }) =>
                isActive
                  ? {
                      color: "var(--text-primary)",
                      background: "color-mix(in srgb, var(--accent) 14%, var(--panel-bg) 86%)",
                      borderColor: "color-mix(in srgb, var(--accent) 58%, var(--panel-border) 42%)",
                      boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent)",
                    }
                  : {
                      color: "var(--text-muted)",
                      background: "transparent",
                      borderColor: "transparent",
                    }
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
