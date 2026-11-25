export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

export const CURRENCY_META = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', minorUnits: 100, decimals: 2 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', minorUnits: 100, decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', minorUnits: 100, decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', minorUnits: 100, decimals: 2 },
};

/**
 * Deterministic reference FX rates expressed as units of currency per 1 USD,
 * stored in micro-units (1_000_000 = 1.000000) to avoid floating-point drift.
 */
export const USD_RATE_MICROS = {
  USD: 1_000_000n,
  INR: 84_000_000n,
  EUR: 920_000n,
  GBP: 790_000n,
};

export const FX_SCALE = 1_000_000n;

export function formatRateMicros(micros) {
  const str = micros.toString().padStart(7, '0');
  const intPart = str.slice(0, -6) || '0';
  const fracPart = str.slice(-6);
  return `${intPart}.${fracPart}`;
}

export function getDeterministicRate(fromCurrency, toCurrency) {
  if (!USD_RATE_MICROS[fromCurrency] || !USD_RATE_MICROS[toCurrency]) {
    throw new Error(`Unsupported currency conversion: ${fromCurrency} -> ${toCurrency}`);
  }
  if (fromCurrency === toCurrency) {
    return '1.000000';
  }
  const fromUsd = USD_RATE_MICROS[fromCurrency];
  const toUsd = USD_RATE_MICROS[toCurrency];
  // rate = toUsd / fromUsd in 1e6 scale: (toUsd * FX_SCALE + fromUsd / 2n) / fromUsd
  const scaled = (toUsd * FX_SCALE + fromUsd / 2n) / fromUsd;
  return formatRateMicros(scaled);
}
