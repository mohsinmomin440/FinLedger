import { forwardRef, useId } from 'react';

export const Select = forwardRef(function Select(
  { label, error, options = [], className = '', id, children, ...props },
  ref
) {
  const autoId = useId();
  const selectId = id || autoId;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-medium text-slate-300">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={`w-full h-10 px-3 rounded-xl bg-[#0B0D12] border ${
          error ? 'border-[#F43F5E]' : 'border-[#1F2533] focus:border-[#8B7CFF]'
        } text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#8B7CFF]/30 transition-colors ${className}`}
        {...props}
      >
        {children ||
          options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
      </select>
      {error && <p className="text-xs text-[#FB7185]">{error}</p>}
    </div>
  );
});
