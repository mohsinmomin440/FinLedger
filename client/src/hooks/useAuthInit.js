import { useEffect } from 'react';
import {
  api,
  bootstrapCrossOriginCsrf,
  getCsrfTokenFromCookie,
  isCrossOriginApi,
  refreshAuthSession,
} from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export function useAuthInit() {
  const setAuthReady = useAuthStore((s) => s.setAuthReady);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (useAuthStore.getState().accessToken) {
        if (active) setAuthReady(true);
        return;
      }

      let hasSessionCookie = Boolean(getCsrfTokenFromCookie());
      if (!hasSessionCookie && isCrossOriginApi()) {
        try {
          const boot = await bootstrapCrossOriginCsrf();
          hasSessionCookie = Boolean(boot?.hasSession);
        } catch {
          hasSessionCookie = false;
        }
      }

      if (!hasSessionCookie) {
        if (active) setAuthReady(true);
        return;
      }

      try {
        await refreshAuthSession();
        const meRes = await api.get('/auth/me');
        if (active && meRes.data?.data) {
          setSession({
            user: meRes.data.data.user,
            workspace: meRes.data.data.workspace,
            workspaces: meRes.data.data.workspaces,
            role: meRes.data.data.role,
          });
        }
      } catch {
        if (active) setAuthReady(true);
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [setAuthReady, setSession]);
}
