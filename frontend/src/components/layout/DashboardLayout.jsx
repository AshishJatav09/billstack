import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { uiStore } from "../../store/uiStore";

const DashboardLayout = () => {
  const { isSidebarPinned } = uiStore();

  return (
    <div
      className="h-screen overflow-hidden"
      style={{
        background: "var(--app-bg)",
        color: "var(--text-primary)",
      }}
    >
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Navbar />
          <main className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:pb-8 lg:pr-8 lg:pt-6 ${isSidebarPinned ? "lg:pl-6" : "lg:pl-4"}`}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
