import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';

const ICONS = {
  success: <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />,
  error: <AlertTriangle className="w-4 h-4 text-[#F43F5E] shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
  info: <Info className="w-4 h-4 text-[#8B7CFF] shrink-0" />,
};

export function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts);
  const removeToast = useUiStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-[#171B25] border border-[#2C3447] shadow-xl"
        >
          <div className="mt-0.5">{ICONS[toast.type] || ICONS.info}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{toast.title}</p>
            {toast.message && <p className="text-xs text-slate-400 mt-0.5">{toast.message}</p>}
          </div>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
