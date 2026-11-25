export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

export const CURRENCY_META = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound' },
};

const USD_RATE_MICROS = {
  USD: 1_000_000n,
  INR: 84_000_000n,
  EUR: 920_000n,
  GBP: 790_000n,
};
const FX_SCALE = 1_000_000n;

export function formatMinor(amountMinor, currency = 'INR') {
  const safe = Number.isSafeInteger(amountMinor) ? amountMinor : 0;
  const meta = CURRENCY_META[currency] || { symbol: `${currency} ` };
  const negative = safe < 0;
  const abs = Math.abs(safe);
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  return `${negative ? '-' : ''}${meta.symbol}${major.toLocaleString('en-US')}.${String(minor).padStart(2, '0')}`;
}

export function minorToDecimalString(amountMinor) {
  const safe = Number.isSafeInteger(amountMinor) ? amountMinor : 0;
  const negative = safe < 0;
  const abs = Math.abs(safe);
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  return `${negative ? '-' : ''}${major}.${String(minor).padStart(2, '0')}`;
}

/**
 * Parses decimal input string like "19.99" into integer minor units (1999)
 * using pure string/integer arithmetic (zero floating-point drift).
 */
export function parseMajorToMinor(input) {
  const raw = String(input ?? '').trim().replace(/,/g, '');
  if (!raw) return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(raw)) {
    return NaN;
  }
  const [majorStr, minorStr = ''] = raw.split('.');
  const major = parseInt(majorStr, 10);
  const minor = parseInt(minorStr.padEnd(2, '0'), 10);
  return major * 100 + minor;
}

export function getDeterministicRate(fromCurrency, toCurrency) {
  if (!USD_RATE_MICROS[fromCurrency] || !USD_RATE_MICROS[toCurrency]) return '1.000000';
  if (fromCurrency === toCurrency) return '1.000000';
  const fromUsd = USD_RATE_MICROS[fromCurrency];
  const toUsd = USD_RATE_MICROS[toCurrency];
  const scaled = (toUsd * FX_SCALE + fromUsd / 2n) / fromUsd;
  const str = scaled.toString().padStart(7, '0');
  return `${str.slice(0, -6) || '0'}.${str.slice(-6)}`;
}

export function convertMinorWithRate(amountMinor, rateInput) {
  if (!Number.isSafeInteger(amountMinor)) return 0;
  const raw = String(rateInput ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) return amountMinor;
  const [intPart, fracPart = ''] = raw.split('.');
  const micros = BigInt(intPart) * FX_SCALE + BigInt((fracPart + '000000').slice(0, 6));
  if (micros <= 0n) return amountMinor;
  const converted = (BigInt(Math.abs(amountMinor)) * micros + FX_SCALE / 2n) / FX_SCALE;
  return amountMinor < 0 ? -Number(converted) : Number(converted);
}

export function distributeAmount(totalMinor, weightsOrCount) {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) return [];

  let weights;
  if (typeof weightsOrCount === 'number') {
    if (!Number.isInteger(weightsOrCount) || weightsOrCount <= 0) return [];
    weights = Array.from({ length: weightsOrCount }, () => 1n);
  } else if (Array.isArray(weightsOrCount) && weightsOrCount.length > 0) {
    weights = weightsOrCount.map((w) => {
      const str = String(w ?? '0').trim();
      if (!/^\d+(\.\d+)?$/.test(str)) return 0n;
      const [intPart, fracPart = ''] = str.split('.');
      return BigInt(intPart) * 10000n + BigInt((fracPart + '0000').slice(0, 4));
    });
  } else {
    return [];
  }

  const totalWeight = weights.reduce((acc, w) => acc + w, 0n);
  if (totalWeight <= 0n) return weights.map(() => 0);

  const totalBig = BigInt(totalMinor);
  const allocations = weights.map((weight, index) => {
    const numerator = totalBig * weight;
    return {
      index,
      share: Number(numerator / totalWeight),
      remainder: numerator % totalWeight,
    };
  });

  const allocated = allocations.reduce((acc, x) => acc + x.share, 0);
  const remaining = totalMinor - allocated;
  const ranked = [...allocations].sort((a, b) => {
    if (b.remainder > a.remainder) return 1;
    if (b.remainder < a.remainder) return -1;
    return a.index - b.index;
  });
  for (let i = 0; i < remaining; i++) {
    ranked[i].share += 1;
  }
  return allocations.map((x) => x.share);
}
