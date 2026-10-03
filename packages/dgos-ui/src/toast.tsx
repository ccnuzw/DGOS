// Toast Notification System
import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toasts: ToastMessage[];
  addToast: (message: string, type?: ToastType, options?: { duration?: number; action?: ToastMessage['action'] }) => void;
  removeToast: (id: string) => void;
  success: (message: string, options?: { duration?: number; action?: ToastMessage['action'] }) => void;
  error: (message: string, options?: { duration?: number; action?: ToastMessage['action'] }) => void;
  info: (message: string, options?: { duration?: number; action?: ToastMessage['action'] }) => void;
  warning: (message: string, options?: { duration?: number; action?: ToastMessage['action'] }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((
    message: string,
    type: ToastType = 'info',
    options?: { duration?: number; action?: ToastMessage['action'] }
  ) => {
    const id = crypto.randomUUID();
    const toast: ToastMessage = {
      id,
      message,
      type,
      duration: options?.duration ?? 5000,
      action: options?.action,
    };
    setToasts(prev => [...prev, toast]);

    if ((toast.duration ?? 0) > 0) {
      setTimeout(() => removeToast(id), toast.duration ?? 0);
    }
  }, [removeToast]);

  const success = useCallback((message: string, options?: { duration?: number; action?: ToastMessage['action'] }) => {
    addToast(message, 'success', options);
  }, [addToast]);

  const error = useCallback((message: string, options?: { duration?: number; action?: ToastMessage['action'] }) => {
    addToast(message, 'error', options);
  }, [addToast]);

  const info = useCallback((message: string, options?: { duration?: number; action?: ToastMessage['action'] }) => {
    addToast(message, 'info', options);
  }, [addToast]);

  const warning = useCallback((message: string, options?: { duration?: number; action?: ToastMessage['action'] }) => {
    addToast(message, 'warning', options);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, info, warning }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onClose }: { toasts: ToastMessage[]; onClose: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(toast.id), 200);
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsExiting(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  };

  return (
    <div
      role="status"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={`dgos-toast ${toast.type} ${isExiting ? 'exiting' : 'entering'}`}
    >
      <span className="toast-icon" aria-hidden="true">{icons[toast.type]}</span>
      <div className="toast-content">{toast.message}</div>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.onClick();
            handleClose();
          }}
          className="toast-action"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={handleClose}
        className="toast-close"
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}
