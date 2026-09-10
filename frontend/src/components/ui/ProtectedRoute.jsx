import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { authStore } from "../../store/authStore";
import { currentSessionRequest } from "../../features/auth/api";
import RouteFallback from "./RouteFallback";

const ProtectedRoute = ({ requireOnboardingComplete = true }) => {
  const location = useLocation();
  const { accessToken, business, clearAuth, setSession } = authStore();
  const [sessionStatus, setSessionStatus] = useState(accessToken ? "checking" : "anonymous");

  useEffect(() => {
    let active = true;

    if (!accessToken) {
      setSessionStatus("anonymous");
      return () => {
        active = false;
      };
    }

    setSessionStatus("checking");
    currentSessionRequest()
      .then((data) => {
        if (!active) return;
        setSession({
          accessToken,
          user: data.user,
          business: data.business,
        });
        setSessionStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        clearAuth();
        setSessionStatus("anonymous");
      });

    return () => {
      active = false;
    };
  }, [accessToken, clearAuth, setSession]);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (sessionStatus === "checking") {
    return <RouteFallback title="Loading workspace" />;
  }

  const isSelfHosted = business?.deploymentMode === "SELF_HOSTED";

  if (isSelfHosted && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" replace />;
  }

  if (!isSelfHosted && !business?.onboardingCompleted && requireOnboardingComplete) {
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
