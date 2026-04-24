import { Navigate, Outlet, useLocation } from "react-router-dom";
import { authStore } from "../../store/authStore";

const ProtectedRoute = ({ requireOnboardingComplete = true }) => {
  const location = useLocation();
  const { accessToken, business } = authStore();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (!business?.onboardingCompleted && requireOnboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  if (business?.subscription?.isExpired && location.pathname !== "/dashboard/settings") {
    return <Navigate to="/dashboard/settings" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
