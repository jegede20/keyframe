import { useCallback, useRef, useState } from 'react';
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
      const toast = { id, message, type, duration };
      setToasts((prev) => [...prev.slice(-3), toast]); // keep the stack short

      if (duration > 0) {
        const timer = setTimeout(() => removeToast(id), duration);
        timers.current.set(id, timer);
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
