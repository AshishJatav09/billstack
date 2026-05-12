import { useEffect } from "react";
import { uiStore } from "../../store/uiStore";

const toneClasses = {
  dark: {
    success: "border-emerald-400/35 bg-slate-950/95 text-emerald-100",
    error: "border-rose-400/35 bg-slate-950/95 text-rose-100",
    info: "border-sky-400/35 bg-slate-950/95 text-sky-100",
  },
  light: {
    success: "border-emerald-300 bg-white/95 text-slate-900",
    error: "border-rose-300 bg-white/95 text-slate-900",
    info: "border-sky-300 bg-white/95 text-slate-900",
  },
};

const accentClasses = {
  dark: {
    success: "bg-emerald-400",
    error: "bg-rose-400",
    info: "bg-sky-400",
  },
  light: {
    success: "bg-emerald-500",
    error: "bg-rose-500",
    info: "bg-sky-500",
  },
};

const ToastViewport = () => {
  const { toasts, removeToast, theme } = uiStore();
  const palette = theme === "light" ? "light" : "dark";

  useEffect(() => {
    if (!toasts.length) {
      return undefined;
    }

    const timers = toasts.map((toast) =>
      window.setTimeout(() => removeToast(toast.id), toast.duration || 3500)
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [removeToast, toasts]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${toneClasses[palette][toast.tone] || toneClasses[palette].info}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${accentClasses[palette][toast.tone] || accentClasses[palette].info}`}
              />
              <div className="min-w-0">
                {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
                <p className="text-sm opacity-90">{toast.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] opacity-70 transition hover:opacity-100"
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToastViewport;
