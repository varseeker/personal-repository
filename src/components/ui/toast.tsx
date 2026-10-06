"use client";

import { createContext, useContext, useState } from "react";

type Toast = { id: number; message: string; tone: "ok" | "error" };
type PushToast = (message: string, tone?: "ok" | "error") => void;

const ToastContext = createContext<PushToast>(() => undefined);

export function useToast(): PushToast {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function push(message: string, tone: "ok" | "error" = "ok") {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={toast.tone === "error" ? "toast error" : "toast"} role="status">
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
