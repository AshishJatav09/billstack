import { useNavigate } from "react-router-dom";
import {
  currentSessionRequest,
  loginRequest,
  logoutRequest,
  registerRequest,
} from "./api";
import { authStore } from "../../store/authStore";
import { uiStore } from "../../store/uiStore";

export const useAuth = () => {
  const navigate = useNavigate();
  const { accessToken, user, business, setSession, clearAuth } = authStore();

  const syncSession = async () => {
    const data = await currentSessionRequest();
    setSession({
      accessToken,
      user: data.user,
      business: data.business,
    });
  };

  const register = async (payload) => {
    const data = await registerRequest(payload);
    setSession(data);
    uiStore.getState().pushToast({
      tone: "success",
      title: "Account created",
      message: "Your business owner account is ready.",
    });
    navigate(data.business.onboardingCompleted ? "/dashboard" : "/onboarding");
  };

  const login = async (payload) => {
    const data = await loginRequest(payload);
    setSession(data);
    uiStore.getState().pushToast({
      tone: "success",
      title: "Welcome back",
      message: "You are signed in to BillStack.",
    });
    navigate(data.business.onboardingCompleted ? "/dashboard" : "/onboarding");
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } finally {
      clearAuth();
      uiStore.getState().pushToast({
        tone: "info",
        message: "You have been logged out.",
      });
      navigate("/login");
    }
  };

  return {
    accessToken,
    business,
    login,
    logout,
    register,
    syncSession,
    user,
  };
};
