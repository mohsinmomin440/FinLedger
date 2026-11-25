import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useWorkspaceSocket } from '../../hooks/useWorkspaceSocket';

export function AppShell() {
  useWorkspaceSocket();

  return (
    <div className="min-h-screen bg-[#0B0D12] text-slate-100 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
