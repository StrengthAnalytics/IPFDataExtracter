import { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const exitTimer = setTimeout(() => {
        setIsExiting(true);
      }, toast.duration - 300); // Start exit animation 300ms before removal

      const removeTimer = setTimeout(() => {
        onClose();
      }, toast.duration);

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(removeTimer);
      };
    }
  }, [toast.duration, onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const typeStyles: Record<ToastType, { bg: string; border: string; icon: string }> = {
    success: {
      bg: 'bg-green-900/90',
      border: 'border-green-500',
      icon: '✓',
    },
    error: {
      bg: 'bg-red-900/90',
      border: 'border-red-500',
      icon: '✕',
    },
    warning: {
      bg: 'bg-yellow-900/90',
      border: 'border-yellow-500',
      icon: '⚠',
    },
    info: {
      bg: 'bg-blue-900/90',
      border: 'border-blue-500',
      icon: 'ℹ',
    },
  };

  const style = typeStyles[toast.type];

  return (
    <div
      className={`
        ${style.bg} ${style.border} border-l-4 rounded-lg shadow-lg p-4
        flex items-center gap-3 min-w-[280px] backdrop-blur-sm
        transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
        animate-slide-in
      `}
      role="alert"
    >
      <span className="text-lg">{style.icon}</span>
      <p className="text-white text-sm flex-1">{toast.message}</p>
      <button
        onClick={handleClose}
        className="text-gray-400 hover:text-white transition-colors p-1"
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
}
