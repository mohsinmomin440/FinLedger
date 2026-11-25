import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');

export function isCrossOriginApi() {
  return /^https?:\/\//i.test(API_BASE_URL);
}

export function getCsrfTokenFromCookie() {
  if (typeof document === 'undefined') return '';
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('finledger_csrf='));
  return match ? decodeURIComponent(match.split('=')[1]) : '';
}

export function resolveCsrfToken() {
  return useAuthStore.getState().csrfToken || getCsrfTokenFromCookie();
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const { accessToken, activeWorkspace } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (activeWorkspace?._id) {
    config.headers['x-workspace-id'] = activeWorkspace._id;
  }
  const csrf = resolveCsrfToken();
  if (csrf) {
    config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

let refreshPromise = null;

export async function bootstrapCrossOriginCsrf() {
  const res = await axios.get(`${API_BASE_URL}/auth/csrf`, { withCredentials: true });
  const payload = res.data?.data;
  if (payload?.csrfToken) {
    useAuthStore.getState().setCsrfToken(payload.csrfToken);
  }
  return payload || { hasSession: false, csrfToken: null };
}

export async function refreshAuthSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      let csrf = resolveCsrfToken();
      if (!csrf && isCrossOriginApi()) {
        const boot = await bootstrapCrossOriginCsrf();
        csrf = boot?.csrfToken || '';
      }
      const res = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: {
            'X-CSRF-Token': csrf,
          },
        }
      );
      const data = res.data?.data;
      if (data?.accessToken) {
        useAuthStore.getState().setSession({
          user: data.user,
          workspace: data.workspace,
          workspaces: data.workspaces || [],
          accessToken: data.accessToken,
          csrfToken: data.csrfToken || resolveCsrfToken(),
        });
      }
      return data;
    })()
      .catch((err) => {
        useAuthStore.getState().clearSession();
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = originalRequest?.url || '';

    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh');

    if (status === 401 && !originalRequest?._retry && !isAuthRoute) {
      originalRequest._retry = true;
      try {
        const refreshed = await refreshAuthSession();
        if (refreshed?.accessToken) {
          originalRequest.headers.Authorization = `Bearer ${refreshed.accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.message || err?.message || fallback;
}
