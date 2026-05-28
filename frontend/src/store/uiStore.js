import { create } from "zustand";

const persistedTheme =
  typeof window === "undefined" ? "light" : localStorage.getItem("billstack-theme") || "light";

const persistedSidebarVisibility =
  typeof window === "undefined"
    ? "visible"
    : localStorage.getItem("billstack-sidebar-visibility") || "visible";

export const uiStore = create((set) => ({
  theme: persistedTheme,
  isSidebarOpen: false,
  isSidebarPinned: persistedSidebarVisibility !== "hidden",
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
  toggleSidebarPinned: () =>
    set((state) => {
      const nextPinned = !state.isSidebarPinned;
      localStorage.setItem("billstack-sidebar-visibility", nextPinned ? "visible" : "hidden");
      return { isSidebarPinned: nextPinned };
    }),
  pushToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          tone: "info",
          ...toast,
        },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}));
