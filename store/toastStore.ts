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

interface ToastStore {
  toasts: ToastItem[];
  addToast: (
    message: string,
    type?: ToastType,
    options?: { title?: string; duration?: number; action?: { label: string; onClick: () => void } }
  ) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'info', options = {}) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = {
      id,
      type,
      message,
      timestamp: Date.now(),
      title: options.title,
      duration: options.duration,
      action: options.action,
    };
    set((state) => ({ toasts: [...state.toasts, newToast] }));
    return id;
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),
}));

export const toast = {
  info: (msg: string, opts?: { title?: string; duration?: number; action?: { label: string; onClick: () => void } }) =>
    useToastStore.getState().addToast(msg, 'info', opts),
  success: (msg: string, opts?: { title?: string; duration?: number; action?: { label: string; onClick: () => void } }) =>
    useToastStore.getState().addToast(msg, 'success', opts),
  warning: (msg: string, opts?: { title?: string; duration?: number; action?: { label: string; onClick: () => void } }) =>
    useToastStore.getState().addToast(msg, 'warning', opts),
  error: (msg: string, opts?: { title?: string; duration?: number; action?: { label: string; onClick: () => void } }) =>
    useToastStore.getState().addToast(msg, 'error', opts),
};
