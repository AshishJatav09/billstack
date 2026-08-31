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

  if (
    business?.deploymentMode !== "SELF_HOSTED" &&
    business?.subscription?.isExpired &&
    location.pathname !== "/dashboard/subscription"
  ) {
    return <Navigate to="/dashboard/subscription" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
