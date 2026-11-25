import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthReady = useAuthStore((s) => s.isAuthReady);
  const location = useLocation();

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0B0D12] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#8B7CFF] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Restoring secure session...</span>
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthReady = useAuthStore((s) => s.isAuthReady);

  if (!isAuthReady) {
    return null;
  }

  if (accessToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
