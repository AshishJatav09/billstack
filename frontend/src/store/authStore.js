import { create } from "zustand";

const persistedSession = (() => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem("billstack-auth");
  return raw ? JSON.parse(raw) : null;
})();

export const authStore = create((set) => ({
  accessToken: persistedSession?.accessToken || "",
  user: persistedSession?.user || null,
  business: persistedSession?.business || null,
  hasHydrated: true,
  setSession: (payload) => {
    const nextState = {
      accessToken: payload.accessToken,
      user: payload.user,
      business: payload.business,
    };

    localStorage.setItem("billstack-auth", JSON.stringify(nextState));
    set(nextState);
  },
  updateBusiness: (business) => {
    set((state) => {
      const nextState = { ...state, business };
      localStorage.setItem(
        "billstack-auth",
        JSON.stringify({
          accessToken: nextState.accessToken,
          user: nextState.user,
          business: nextState.business,
        })
      );
      return nextState;
    });
  },
  clearAuth: () => {
    localStorage.removeItem("billstack-auth");
    set({
      accessToken: "",
      user: null,
      business: null,
    });
  },
}));
