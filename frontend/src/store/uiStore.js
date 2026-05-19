import { create } from "zustand";

const persistedTheme =
  typeof window === "undefined" ? "light" : localStorage.getItem("billstack-theme") || "light";

export const uiStore = create((set) => ({
  theme: persistedTheme,
  isSidebarOpen: false,
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
