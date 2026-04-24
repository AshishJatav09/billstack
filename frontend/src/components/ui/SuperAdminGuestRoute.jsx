import { Navigate, Outlet } from "react-router-dom";
import { superAdminStore } from "../../store/superAdminStore";

const SuperAdminGuestRoute = () => {
  const { accessToken } = superAdminStore();

  if (!accessToken) {
    return <Outlet />;
  }

  return <Navigate to="/super-admin" replace />;
};

export default SuperAdminGuestRoute;
