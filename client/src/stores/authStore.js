import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  accessToken: null,
  csrfToken: null,
  user: null,
  activeWorkspace: null,
  workspaces: [],
  role: null,
  isAuthReady: false,

  setSession: ({ user, workspace, workspaces, accessToken, csrfToken, role }) =>
    set((state) => ({
      user: user !== undefined ? user : state.user,
      activeWorkspace: workspace !== undefined ? workspace : state.activeWorkspace,
      workspaces: workspaces !== undefined ? workspaces : state.workspaces,
      accessToken: accessToken !== undefined ? accessToken : state.accessToken,
      csrfToken: csrfToken !== undefined ? csrfToken : state.csrfToken,
      role: role !== undefined ? role : state.role,
      isAuthReady: true,
    })),

  setAccessToken: (accessToken) => set({ accessToken }),

  setCsrfToken: (csrfToken) => set({ csrfToken }),

  setActiveWorkspace: (workspace, role = null) =>
    set((state) => ({
      activeWorkspace: workspace,
      role: role || state.role,
    })),

  setWorkspaces: (workspaces) => set({ workspaces }),

  setAuthReady: (isAuthReady) => set({ isAuthReady }),

  clearSession: () =>
    set({
      accessToken: null,
      csrfToken: null,
      user: null,
      activeWorkspace: null,
      workspaces: [],
      role: null,
      isAuthReady: true,
    }),
}));
