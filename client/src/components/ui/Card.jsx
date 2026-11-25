export function Card({ title, subtitle, action, className = '', children }) {
  return (
    <div className={`bg-[#171B25] border border-[#1F2533] rounded-2xl ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[#1F2533]">
          <div>
            {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
