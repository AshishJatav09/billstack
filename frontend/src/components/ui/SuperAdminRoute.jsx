import { Navigate, Outlet } from "react-router-dom";
import { superAdminStore } from "../../store/superAdminStore";

const SuperAdminRoute = () => {
  const { accessToken } = superAdminStore();

  if (!accessToken) {
    return <Navigate to="/super-admin/login" replace />;
  }

  return <Outlet />;
};

export default SuperAdminRoute;
