import { create } from "zustand";

const persistedTheme =
  typeof window === "undefined" ? "light" : localStorage.getItem("billstack-theme") || "light";

const persistedSidebarCollapsed = typeof window !== "undefined" &&
  (localStorage.getItem("billstack-sidebar-collapsed") === "true" ||
    (localStorage.getItem("billstack-sidebar-collapsed") === null &&
      localStorage.getItem("billstack-sidebar-visibility") === "hidden"));

export const uiStore = create((set) => ({
  theme: persistedTheme,
  isSidebarOpen: false,
  sidebarCollapsed: persistedSidebarCollapsed,
  toasts: [],
  setTheme: (theme) => {
    localStorage.setItem("billstack-theme", theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((state) => {
      const nextTheme = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("billstack-theme", nextTheme);
      return { theme: nextTheme };
    }),
  openSidebar: () => set({ isSidebarOpen: true }),
  closeSidebar: () => set({ isSidebarOpen: false }),
  toggleSidebarCollapsed: () =>
    set((state) => {
      const sidebarCollapsed = !state.sidebarCollapsed;
      localStorage.setItem("billstack-sidebar-collapsed", String(sidebarCollapsed));
      return { sidebarCollapsed };
    }),
  pushToast: (toast) =>
    set((state) => {
      const now = Date.now();
      const duplicate = state.toasts.some(
        (row) =>
          row.title === toast.title &&
          row.message === toast.message &&
          now - Number(row.createdAt || 0) < 1500
      );
      if (duplicate) return state;
      return {
        toasts: [
          ...state.toasts,
          {
            id: `${now}-${Math.random().toString(16).slice(2)}`,
            createdAt: now,
            tone: "info",
            ...toast,
          },
        ],
      };
    }),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}));
