import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  timestamp: number;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastOptions {
  id?: string;
  title?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType, options?: ToastOptions) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'info', options = {}) => {
    const id = options.id || Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = {
      id,
      type,
      message,
      timestamp: Date.now(),
      title: options.title,
      duration: options.duration,
      action: options.action,
    };
    set((state) => {
      const existsIndex = state.toasts.findIndex((t) => t.id === id);
      if (existsIndex >= 0) {
        const next = [...state.toasts];
        next[existsIndex] = newToast;
        return { toasts: next };
      }
      return { toasts: [...state.toasts, newToast] };
    });
    return id;
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}));

export const toast = {
  info: (msg: string, opts?: ToastOptions) =>
    useToastStore.getState().addToast(msg, 'info', opts),
  success: (msg: string, opts?: ToastOptions) =>
    useToastStore.getState().addToast(msg, 'success', opts),
  warning: (msg: string, opts?: ToastOptions) =>
    useToastStore.getState().addToast(msg, 'warning', opts),
  error: (msg: string, opts?: ToastOptions) =>
    useToastStore.getState().addToast(msg, 'error', opts),
  dismiss: (id: string) => useToastStore.getState().dismissToast(id),
};
