import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

const DashboardLayout = () => {

  return (
    <div
      className="dashboard-shell h-screen overflow-hidden h-[100dvh]"
      style={{
        background: "var(--app-bg)",
        color: "var(--text-primary)",
      }}
    >
      <div className="flex h-full overflow-hidden">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Navbar />
          <main className="dashboard-content min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-6 lg:pb-8 lg:pr-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
