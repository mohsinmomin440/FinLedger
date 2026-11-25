export function EmptyState({ icon: Icon, title, description, action = null }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-[#1F2533] flex items-center justify-center text-[#8B7CFF] mb-4">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      {description && <p className="text-xs text-slate-400 max-w-sm mt-1.5">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
