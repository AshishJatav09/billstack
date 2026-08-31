import { NavLink, matchPath, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  BellRing,
  Boxes,
  Building2,
  CalendarCheck2,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  PackageCheck,
  Pin,
  ReceiptIndianRupee,
  RefreshCw,
  RotateCcw,
  Settings,
  ShoppingBag,
  ListChecks,
  Users,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { useEffect } from "react";
import { authStore } from "../../store/authStore";
import { uiStore } from "../../store/uiStore";
import { getBusinessModulesRequest } from "../../features/auth/api";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, matches: ["/dashboard"], end: true },
  { label: "Invoices", to: "/dashboard/invoices", icon: ReceiptIndianRupee, matches: ["/dashboard/invoices", "/dashboard/invoices/:invoiceId"] },
  { label: "Quotations", to: "/dashboard/quotes", icon: FileText, matches: ["/dashboard/quotes"] },
  { label: "Orders", to: "/dashboard/orders", icon: ClipboardList, matches: ["/dashboard/orders"] },
  { label: "Credit Notes", to: "/dashboard/credit-notes", icon: WalletCards, matches: ["/dashboard/credit-notes"] },
  { label: "Sales Returns", to: "/dashboard/sales-returns", icon: RotateCcw, matches: ["/dashboard/sales-returns"] },
  { label: "Customers", to: "/dashboard/customers", icon: UserRound, matches: ["/dashboard/customers"] },
  { label: "Products / Inventory", to: "/dashboard/products", icon: Boxes, matches: ["/dashboard/products"] },
  { label: "Suppliers", to: "/dashboard/suppliers", icon: Building2, matches: ["/dashboard/suppliers"] },
  { label: "Purchases", to: "/dashboard/purchases", icon: ShoppingBag, matches: ["/dashboard/purchases"] },
  { label: "Expenses", to: "/dashboard/expenses", icon: ReceiptIndianRupee, matches: ["/dashboard/expenses"] },
  { label: "Reports / GST", to: "/dashboard/reports", icon: BarChart3, matches: ["/dashboard/reports"] },
  { label: "Communications / WhatsApp", to: "/dashboard/communications", icon: BellRing, matches: ["/dashboard/communications"] },
  { label: "Projects", to: "/dashboard/projects", icon: FileText, matches: ["/dashboard/projects"] },
  { label: "Tasks", to: "/dashboard/tasks", icon: ListChecks, matches: ["/dashboard/tasks"] },
  { label: "Recurring Billing", to: "/dashboard/recurring-billing", icon: RefreshCw, matches: ["/dashboard/recurring-billing"] },
  { label: "Appointments", to: "/dashboard/appointments", icon: CalendarCheck2, matches: ["/dashboard/appointments"] },
  { label: "Production / Job Work", to: "/dashboard/production-jobs", icon: PackageCheck, matches: ["/dashboard/production-jobs"] },
  { label: "Batch & Expiry", to: "/dashboard/batches", icon: Boxes, matches: ["/dashboard/batches"] },
  { label: "Dispatch / Fulfilment", to: "/dashboard/dispatches", icon: ClipboardList, matches: ["/dashboard/dispatches"] },
  { label: "Documents & Approvals", to: "/dashboard/approvals", icon: FileText, matches: ["/dashboard/approvals"] },
  { label: "Team", to: "/dashboard/team", icon: Users, matches: ["/dashboard/team"], roles: ["owner", "admin"] },
  { label: "HR", to: "/dashboard/hr/employees", icon: Users, matches: ["/dashboard/hr/employees"], requiresHR: true },
  { label: "Attendance", to: "/dashboard/hr/attendance", icon: CalendarCheck2, matches: ["/dashboard/hr/attendance"], requiresHR: true },
  { label: "Salary Setup", to: "/dashboard/hr/salary-setup", icon: WalletCards, matches: ["/dashboard/hr/salary-setup"], requiresHR: true },
  { label: "Subscription", to: "/dashboard/subscription", icon: WalletCards, matches: ["/dashboard/subscription"] },
  { label: "Settings", to: "/dashboard/settings", icon: Settings, matches: ["/dashboard/settings"] },
];

const isRouteActive = (item, pathname) =>
  item.matches.some((pattern) => Boolean(matchPath({ path: pattern, end: true }, pathname)));

const canShowItem = (item, user) => {
  if (item.roles?.length && !item.roles.includes(user?.role)) return false;

  if (item.requiresHR) {
    return ["owner", "admin"].includes(user?.role) || user?.permissions?.canViewHR || user?.permissions?.canManageHR;
  }

  return true;
};

const activeStyle = {
  color: "white",
  background: "var(--accent)",
  boxShadow: "0 4px 14px color-mix(in srgb, var(--accent) 22%, transparent)",
};

const inactiveStyle = {
  color: "var(--text-muted)",
};

const Sidebar = () => {
  const { business, user } = authStore();
  const { closeSidebar, isSidebarOpen, isSidebarPinned, toggleSidebarPinned } = uiStore();
  const location = useLocation();
  const [isHoverPreview, setIsHoverPreview] = useState(false);
  const [moduleData, setModuleData] = useState(null);
  const isCollapsed = !isSidebarPinned;
  const isExpanded = !isCollapsed || isHoverPreview;
  useEffect(() => {
    getBusinessModulesRequest()
      .then(setModuleData)
      .catch(() => setModuleData(null));
  }, []);

  const moduleState = new Map((moduleData?.catalog || []).map((item) => [item.key, item.state]));
  const routeModules = {
    "/dashboard/invoices": "invoices",
    "/dashboard/quotes": "quotations",
    "/dashboard/orders": "order_management",
    "/dashboard/credit-notes": "credit_notes",
    "/dashboard/sales-returns": "sales_returns",
    "/dashboard/customers": "customers",
    "/dashboard/products": "products_services",
    "/dashboard/suppliers": "suppliers",
    "/dashboard/purchases": "purchases",
    "/dashboard/expenses": "expenses",
    "/dashboard/reports": "reports",
    "/dashboard/communications": "communications",
    "/dashboard/projects": "projects_tasks",
    "/dashboard/tasks": "projects_tasks",
    "/dashboard/recurring-billing": "recurring_billing",
    "/dashboard/appointments": "appointments_scheduling",
    "/dashboard/production-jobs": "production_job_work",
    "/dashboard/batches": "batch_expiry",
    "/dashboard/dispatches": "dispatch_fulfilment",
    "/dashboard/approvals": "documents_approvals",
    "/dashboard/team": "team",
    "/dashboard/hr/employees": "hr",
    "/dashboard/hr/attendance": "hr",
    "/dashboard/hr/salary-setup": "hr",
  };
  const visibleItems = navItems.filter((item) => {
    if (!canShowItem(item, user)) return false;
    if (item.to === "/dashboard/subscription" && moduleData?.deploymentMode === "SELF_HOSTED") return false;
    const moduleKey = routeModules[item.to];
    if (!moduleKey || !moduleData) return true;
    return (moduleState.get(moduleKey) || "ACTIVE") === "ACTIVE";
  });

  return (
    <>
      {isSidebarOpen ? <button type="button" aria-label="Close navigation" onClick={closeSidebar} className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden" /> : null}
      {isCollapsed ? <div className="fixed inset-y-0 left-0 z-20 hidden w-2 lg:block" onMouseEnter={() => setIsHoverPreview(true)} /> : null}
      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.aside
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 34, mass: 0.8 }}
            onMouseEnter={() => isCollapsed && setIsHoverPreview(true)}
            onMouseLeave={() => isCollapsed && setIsHoverPreview(false)}
            className={`fixed inset-y-0 left-0 z-30 flex flex-col overflow-hidden overscroll-contain py-6 transition-transform duration-200 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}
            style={{
              borderRight: "1px solid var(--panel-border)",
              background: "color-mix(in srgb, var(--panel-bg) 96%, transparent)",
              color: "var(--text-primary)",
              backdropFilter: "blur(14px)",
            }}
          >
            <div className="relative mb-7 px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">B</div>
                <div className="min-w-0">
                  <p className="text-base font-bold tracking-tight">BillStack</p>
                  <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{business?.name || "Workspace"}</p>
                </div>
              </div>
              <motion.button
                type="button"
                onClick={() => {
                  toggleSidebarPinned();
                  if (isSidebarPinned) setIsHoverPreview(false);
                }}
                className="absolute right-4 top-1 hidden rounded-xl p-2 text-[color:var(--text-muted)] lg:flex"
                whileHover={{ scale: 1.06 }}
                aria-label={isSidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
              >
                <Pin size={17} className={isSidebarPinned ? "rotate-45" : ""} />
              </motion.button>
              <button type="button" onClick={closeSidebar} className="mt-4 rounded-lg border px-3 py-1.5 text-xs lg:hidden" style={{ borderColor: "var(--panel-border)", color: "var(--text-muted)" }}>
                Close menu
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-6">
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                Workspace
              </p>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = isRouteActive(item, location.pathname);

                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    end={item.end}
                    onClick={closeSidebar}
                    className="group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-slate-500/[.08] hover:text-[color:var(--text-primary)]"
                    style={active ? activeStyle : inactiveStyle}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Icon size={17} strokeWidth={1.8} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <ChevronRight size={15} className={active ? "opacity-75" : "opacity-35 transition group-hover:opacity-60"} />
                  </NavLink>
                );
              })}
            </nav>

            <div className="mx-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-200">Current plan</p>
              <p className="mt-1 text-sm font-semibold text-white">{business?.plan?.name || "Free"}</p>
              <p className="mt-1 text-xs text-slate-400">Manage your plan in Subscription.</p>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
