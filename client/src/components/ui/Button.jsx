import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-[#8B7CFF] hover:bg-[#7A68FF] text-white shadow-sm shadow-[#8B7CFF]/20 border border-transparent',
  secondary: 'bg-[#1F2533] hover:bg-[#2A3245] text-slate-100 border border-[#2C3447]',
  ghost: 'bg-transparent hover:bg-[#1F2533] text-slate-300 border border-transparent',
  danger: 'bg-[#F43F5E]/15 hover:bg-[#F43F5E]/25 text-[#FB7185] border border-[#F43F5E]/30',
  emerald: 'bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#34D399] border border-[#10B981]/30',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-11 px-5 text-sm rounded-xl',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled = false, className = '', children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#8B7CFF]/50 disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
});
