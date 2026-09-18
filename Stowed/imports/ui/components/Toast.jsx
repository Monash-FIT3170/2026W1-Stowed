import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import "./Toast.css";

/**
 * Lightweight app-wide toast notifications.
 *
 * Wrap the app in <ToastProvider> once (see App.jsx), then from any component:
 *
 *   const toast = useToast();
 *   toast.success("Product saved");
 *   toast.error(err.reason || err.message || "Something went wrong");
 *
 * Toasts auto-dismiss after `duration` ms (default 4000) and can be closed
 * manually. Errors default to a longer, sticky-ish duration so the user has
 * time to read them.
 */

const ToastContext = createContext(null);

const DEFAULT_DURATIONS = {
  success: 3500,
  info: 4000,
  error: 6000,
};

let nextToastId = 0;

function ToastItem({ toast, onDismiss }) {
  const { id, type, message } = toast;

  useEffect(() => {
    if (toast.duration === Infinity) return undefined;
    const timer = setTimeout(() => onDismiss(id), toast.duration);
    return () => clearTimeout(timer);
  }, [id, toast.duration, onDismiss]);

  const icon = type === "success" ? "✓" : type === "error" ? "!" : "i";

  return (
    <div className={`toast toast-${type}`} role={type === "error" ? "alert" : "status"}>
      <span className="toast-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="toast-message">{message}</span>
      <button
        type="button"
        className="toast-close"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((message, { type = "info", duration } = {}) => {
    if (!message) return null;
    const id = ++nextToastId;
    setToasts((current) => [
      ...current,
      { id, type, message, duration: duration ?? DEFAULT_DURATIONS[type] ?? 4000 },
    ]);
    return id;
  }, []);

  // Stable helpers so callers can drop `toast` into effect deps safely.
  const api = useMemo(
    () => ({
      show,
      dismiss,
      success: (message, options) => show(message, { ...options, type: "success" }),
      error: (message, options) => show(message, { ...options, type: "error" }),
      info: (message, options) => show(message, { ...options, type: "info" }),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-viewport" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Used when useToast is called with no provider above it (e.g. a component
// rendered in isolation in a unit test) so calls no-op instead of crashing.
const noop = () => null;
const NOOP_TOAST_API = { show: noop, dismiss: noop, success: noop, error: noop, info: noop };

/**
 * Returns the toast API. Safe to call outside a provider — it degrades to
 * no-ops so a component never crashes if the provider is missing.
 */
export function useToast() {
  return useContext(ToastContext) ?? NOOP_TOAST_API;
}
