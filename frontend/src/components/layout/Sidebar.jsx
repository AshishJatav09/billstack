import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Pin } from "lucide-react";
import { useState } from "react";
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
  { label: "Employees", to: "/dashboard/hr/employees" },
  { label: "Attendance", to: "/dashboard/hr/attendance" },
  { label: "Salary Setup", to: "/dashboard/hr/salary-setup" },
  { label: "Settings", to: "/dashboard/settings" },
];

const Sidebar = () => {
  const { business } = authStore();
  const { closeSidebar, isSidebarOpen, isSidebarPinned, toggleSidebarPinned } = uiStore();
  const isCollapsed = !isSidebarPinned;
  const [isHoverPreview, setIsHoverPreview] = useState(false);

  const isPreviewOpen = isCollapsed && isHoverPreview;
  const isExpanded = !isCollapsed || isPreviewOpen;
  const sidebarWidth = 288;

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

      {isCollapsed ? (
        <div
          className="fixed inset-y-0 left-0 z-20 hidden w-2 lg:block"
          onMouseEnter={() => setIsHoverPreview(true)}
        />
      ) : null}

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.aside
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: sidebarWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 340,
              damping: 34,
              mass: 0.8,
            }}
            onMouseEnter={() => {
              if (isCollapsed) setIsHoverPreview(true);
            }}
            onMouseLeave={() => {
              if (isCollapsed) setIsHoverPreview(false);
            }}
            className={`fixed inset-y-0 left-0 z-30 flex flex-col overflow-hidden overscroll-contain py-8 transition-transform duration-200 ${
              isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            } lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}
            style={{
              borderRight: "1px solid var(--panel-border)",
              background: "color-mix(in srgb, var(--panel-bg) 96%, transparent)",
              color: "var(--text-primary)",
              backdropFilter: "blur(14px)",
            }}
          >
          <div className="relative mb-10 px-6">
            <p className="text-sm uppercase tracking-[0.35em] text-brand-300">BillStack</p>
            <h2 className="mt-3 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>{business?.name || "Workspace"}</h2>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              {business?.plan?.name || "Free"} plan. Every request stays isolated to this business.
            </p>
          <motion.button
            type="button"
            onClick={() => {
              toggleSidebarPinned();
              if (isSidebarPinned) {
                setIsHoverPreview(false);
              }
            }}
            className="absolute right-0 top-0 hidden items-center justify-center rounded-xl p-2 text-[color:var(--text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] lg:flex"
            style={{
              background: "transparent",
              WebkitBackdropFilter: "blur(12px)",
              backdropFilter: "blur(12px)",
            }}
            initial={false}
            whileHover={{
              scale: 1.06,
              color: "var(--text-primary)",
              backgroundColor: "color-mix(in srgb, var(--panel-bg) 86%, transparent)",
              boxShadow: "0 10px 26px rgba(15, 23, 42, 0.10)",
            }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            aria-label={isSidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
            title={isSidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
          >
            <Pin size={18} className={isSidebarPinned ? "rotate-45" : ""} />
          </motion.button>
            <button
              type="button"
              onClick={closeSidebar}
              className="mt-4 rounded-full px-3 py-2 text-xs uppercase tracking-[0.2em] lg:hidden"
              style={{
                border: "1px solid var(--panel-border)",
                color: "var(--text-muted)",
              }}
            >
              Close
            </button>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto pb-6 pr-1 px-6">
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
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
