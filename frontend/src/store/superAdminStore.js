import { create } from "zustand";

const persistedSession = (() => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem("billstack-super-admin");
  return raw ? JSON.parse(raw) : null;
})();

export const superAdminStore = create((set) => ({
  accessToken: persistedSession?.accessToken || "",
  email: persistedSession?.email || "",
  hasHydrated: true,
  setSession: (payload) => {
    const nextState = {
      accessToken: payload.accessToken,
      email: payload.email,
    };

    localStorage.setItem("billstack-super-admin", JSON.stringify(nextState));
    set(nextState);
  },
  clearSession: () => {
    localStorage.removeItem("billstack-super-admin");
    set({
      accessToken: "",
      email: "",
    });
  },
}));
