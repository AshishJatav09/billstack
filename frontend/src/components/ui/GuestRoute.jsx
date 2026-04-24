import { Navigate, Outlet } from "react-router-dom";
import { authStore } from "../../store/authStore";

const GuestRoute = () => {
  const { accessToken, business } = authStore();

  if (!accessToken) {
    return <Outlet />;
  }

  return <Navigate to={business?.onboardingCompleted ? "/dashboard" : "/onboarding"} replace />;
};

export default GuestRoute;

