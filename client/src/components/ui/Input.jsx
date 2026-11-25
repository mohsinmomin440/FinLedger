import { forwardRef, useId } from 'react';

export const Input = forwardRef(function Input(
  { label, error, hint, className = '', id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-slate-300">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`w-full h-10 px-3 rounded-xl bg-[#0B0D12] border ${
          error ? 'border-[#F43F5E] focus:ring-[#F43F5E]/40' : 'border-[#1F2533] focus:border-[#8B7CFF] focus:ring-[#8B7CFF]/30'
        } text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-colors ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-[#FB7185]">{error}</p>}
      {!error && hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
});
