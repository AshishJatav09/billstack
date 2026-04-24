import { useEffect } from "react";
import { uiStore } from "../../store/uiStore";

const toneClasses = {
  success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
  error: "border-rose-500/40 bg-rose-500/15 text-rose-100",
  info: "border-sky-500/40 bg-sky-500/15 text-sky-100",
};

const ToastViewport = () => {
  const { toasts, removeToast } = uiStore();

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
          className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${toneClasses[toast.tone] || toneClasses.info}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
              <p className="text-sm">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-xs uppercase tracking-[0.2em] opacity-80"
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
