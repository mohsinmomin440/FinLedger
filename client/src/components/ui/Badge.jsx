const BADGE_VARIANTS = {
  neutral: 'bg-slate-800/80 text-slate-300 border-slate-700',
  emerald: 'bg-[#10B981]/15 text-[#34D399] border-[#10B981]/30',
  rose: 'bg-[#F43F5E]/15 text-[#FB7185] border-[#F43F5E]/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  violet: 'bg-[#8B7CFF]/15 text-[#A78BFA] border-[#8B7CFF]/30',
  sky: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
};

export function Badge({ variant = 'neutral', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
        BADGE_VARIANTS[variant] || BADGE_VARIANTS.neutral
      } ${className}`}
    >
      {children}
    </span>
  );
}
