import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, LogOut, Menu } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { disconnectWorkspaceSocket } from '../../lib/socket';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { Badge, Button } from '../ui';

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const activeWorkspace = useAuthStore((s) => s.activeWorkspace);
  const clearSession = useAuthStore((s) => s.clearSession);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: notifData } = useQuery({
    queryKey: ['notifications', activeWorkspace?._id],
    queryFn: async () => (await api.get('/notifications')).data.data,
    enabled: Boolean(activeWorkspace?._id),
  });

  const unreadCount = notifData?.unreadCount || 0;

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Proceed clearing local memory state regardless
    } finally {
      disconnectWorkspaceSocket();
      qc.clear();
      clearSession();
      navigate('/login');
    }
  };

  return (
    <header className="h-16 px-4 lg:px-6 bg-[#11141C]/90 backdrop-blur border-b border-[#1F2533] flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Open navigation"
          className="lg:hidden p-2 rounded-xl text-slate-300 hover:bg-[#171B25]"
        >
          <Menu className="w-5 h-5" />
        </button>
        <WorkspaceSwitcher />
        {role && <Badge variant="violet">{role}</Badge>}
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/notifications"
          aria-label="Notifications"
          className="relative p-2 rounded-xl bg-[#171B25] border border-[#1F2533] text-slate-300 hover:text-white"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F43F5E] text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        <div className="hidden sm:flex flex-col text-right">
          <span className="text-xs font-medium text-white">{user?.name}</span>
          <span className="text-[11px] text-slate-400">{user?.email}</span>
        </div>

        <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Logout">
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
