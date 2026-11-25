import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  BookOpen,
  Target,
  Users,
  Briefcase,
  FileText,
  Repeat,
  BarChart3,
  Shield,
  Bell,
  Settings,
  X,
} from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
      { to: '/accounts', label: 'Accounts', icon: Wallet },
      { to: '/ledger', label: 'Double-Entry Ledger', icon: BookOpen },
      { to: '/budgets', label: 'Budgets', icon: Target },
    ],
  },
  {
    label: 'Split & Bill',
    items: [
      { to: '/groups', label: 'Expense Groups', icon: Users },
      { to: '/clients', label: 'Clients', icon: Briefcase },
      { to: '/invoices', label: 'Invoices', icon: FileText },
      { to: '/recurring', label: 'Recurring Rules', icon: Repeat },
    ],
  },
  {
    label: 'Insights & Admin',
    items: [
      { to: '/analytics', label: 'Analytics & Reports', icon: BarChart3 },
      { to: '/team', label: 'Team & RBAC', icon: Shield },
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#11141C] border-r border-[#1F2533] flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-[#1F2533]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#8B7CFF] to-[#10B981] flex items-center justify-center font-bold text-white text-sm">
              FL
            </div>
            <div>
              <span className="text-sm font-bold text-white tracking-tight">FinLedger</span>
              <span className="block text-[10px] text-slate-400">Ledger &amp; Split Cloud</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-[#8B7CFF]/15 text-[#A78BFA] border border-[#8B7CFF]/25'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-[#171B25] border border-transparent'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
