import { createContext, createElement, useCallback, useContext, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

/** Section 5.5 — toasts: { id, message, type, duration } */
export default function useToast() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const removeToast = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message, type = 'success', duration = 3000) => {
      const id = uuidv4();
      setToasts((prev) => [...prev.slice(-3), { id, message, type, duration }]); // short stack
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => removeToast(id), duration)
        );
      }
      return id;
    },
    [removeToast]
  );

  const clearToasts = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
    setToasts([]);
  }, []);

  return { toasts, addToast, removeToast, clearToasts };
}

/* ── App-wide access ─────────────────────────────────────────────────────
   useToast stays the source of truth (spec API); this thin context lets any
   component fire a toast without prop-drilling. */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const value = useToast();
  return createElement(ToastContext.Provider, { value }, children);
}

/** Returns the app-level toast API, or a no-op version outside the provider. */
export function useToastSafe() {
  const ctx = useContext(ToastContext);
  const noop = useCallback(() => {}, []);
  return ctx || { toasts: [], addToast: noop, removeToast: noop, clearToasts: noop };
}

export function useToastContextValue() {
  return useToast();
}
