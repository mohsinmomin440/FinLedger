import { create } from 'zustand';

let nextToastId = 1;

export const useUiStore = create((set) => ({
  sidebarOpen: false,
  toasts: [],

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  addToast: ({ title, message = '', type = 'info', duration = 4000 }) => {
    const id = nextToastId++;
    set((state) => ({
      toasts: [...state.toasts, { id, title, message, type }],
    }));
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
    return id;
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
