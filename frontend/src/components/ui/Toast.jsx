// frontend/src/components/ui/Toast.jsx
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const TOAST_STYLES = {
  success: { icon: CheckCircle2, cls: 'text-green-600' },
  error:   { icon: XCircle,      cls: 'text-red-600' },
  info:    { icon: Info,         cls: 'text-cuhk-primary' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback(({ type = 'info', message, duration = 4500 }) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, type, message }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
  }, [dismiss]);

  const api = useMemo(() => ({
    push,
    success: (message, duration) => push({ type: 'success', message, duration }),
    error:   (message, duration) => push({ type: 'error', message, duration }),
    info:    (message, duration) => push({ type: 'info', message, duration }),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none"
      >
        {toasts.map(t => {
          const { icon: Icon, cls } = TOAST_STYLES[t.type] || TOAST_STYLES.info;
          return (
            <div
              key={t.id}
              role="status"
              className="animate-toast-in pointer-events-auto flex items-start gap-3 bg-white border border-slate-200 shadow-lg rounded-xl p-3.5"
            >
              <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${cls}`} aria-hidden="true" />
              <p className="text-sm text-slate-700 flex-1 leading-relaxed">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer
                  transition-colors duration-150
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cuhk-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // No-op fallback so components don't crash outside the provider.
    return { push: () => {}, success: () => {}, error: () => {}, info: () => {} };
  }
  return ctx;
}