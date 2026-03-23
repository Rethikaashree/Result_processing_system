import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext({ pushToast: () => {} });

const buildToast = (type, message) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type,
  message
});

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((type, message) => {
    if (!message) return;
    const toast = buildToast(type, message);
    setToasts((prev) => [...prev, toast]);
    window.setTimeout(() => removeToast(toast.id), 3800);
  }, [removeToast]);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
            <button className="toast-close" type="button" onClick={() => removeToast(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
