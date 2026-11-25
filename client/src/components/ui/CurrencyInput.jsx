import { useId } from 'react';
import { CURRENCY_META } from '../../lib/money';

export function CurrencyInput({
  label,
  currency = 'INR',
  value,
  onChange,
  error,
  placeholder = '0.00',
  id,
  name,
  disabled = false,
}) {
  const autoId = useId();
  const inputId = id || autoId;
  const symbol = CURRENCY_META[currency]?.symbol || currency;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-slate-300">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <span className="absolute left-3 text-sm font-medium text-slate-400 select-none">
          {symbol}
        </span>
        <input
          id={inputId}
          name={name}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full h-10 pl-8 pr-14 rounded-xl bg-[#0B0D12] border ${
            error ? 'border-[#F43F5E]' : 'border-[#1F2533] focus:border-[#8B7CFF]'
          } text-sm text-slate-100 tabular-nums placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#8B7CFF]/30`}
        />
        <span className="absolute right-3 text-[11px] font-mono text-slate-400 select-none">
          {currency}
        </span>
      </div>
      {error && <p className="text-xs text-[#FB7185]">{error}</p>}
    </div>
  );
}
