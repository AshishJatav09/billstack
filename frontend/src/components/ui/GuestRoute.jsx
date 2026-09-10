import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { authStore } from "../../store/authStore";
import { currentSessionRequest } from "../../features/auth/api";
import RouteFallback from "./RouteFallback";

const GuestRoute = () => {
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
    return <Outlet />;
  }

  if (sessionStatus === "checking") {
    return <RouteFallback title="Loading session" />;
  }

  return <Navigate to={business?.deploymentMode === "SELF_HOSTED" || business?.onboardingCompleted ? "/dashboard" : "/onboarding"} replace />;
};

export default GuestRoute;
