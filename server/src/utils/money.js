import { CURRENCY_META, FX_SCALE, getDeterministicRate } from '../constants/currencies.js';

export function assertMinorInt(value, fieldName = 'amountMinor') {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`${fieldName} must be a safe integer in minor units`);
  }
  return value;
}

export function assertNonNegativeMinor(value, fieldName = 'amountMinor') {
  assertMinorInt(value, fieldName);
  if (value < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }
  return value;
}

export function assertPositiveMinor(value, fieldName = 'amountMinor') {
  assertMinorInt(value, fieldName);
  if (value <= 0) {
    throw new Error(`${fieldName} must be greater than zero`);
  }
  return value;
}

/**
 * Parses a decimal string or number (e.g. "84.250000" or 1.5) into 1e6-scaled BigInt micros
 * without floating-point rounding drift.
 */
export function parseDecimalToMicros(rateInput) {
  const raw = typeof rateInput === 'number' ? String(rateInput) : String(rateInput ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid decimal rate: ${rateInput}`);
  }
  const [intPart, fracPart = ''] = raw.split('.');
  const paddedFrac = (fracPart + '000000').slice(0, 6);
  const micros = BigInt(intPart) * FX_SCALE + BigInt(paddedFrac);
  if (micros <= 0n) {
    throw new Error('Exchange rate must be greater than zero');
  }
  return micros;
}

export function normalizeRateString(rateInput) {
  const micros = parseDecimalToMicros(rateInput);
  const str = micros.toString().padStart(7, '0');
  return `${str.slice(0, -6) || '0'}.${str.slice(-6)}`;
}

export function convertMinorWithRate(amountMinor, rateInput) {
  assertMinorInt(amountMinor, 'amountMinor');
  const micros = parseDecimalToMicros(rateInput);
  const sign = amountMinor < 0 ? -1n : 1n;
  const absAmount = BigInt(Math.abs(amountMinor));
  const converted = (absAmount * micros + FX_SCALE / 2n) / FX_SCALE;
  return Number(sign * converted);
}

export function resolveFxConversion({
  amountMinor,
  originalCurrency,
  baseCurrency,
  manualRate = null,
}) {
  assertNonNegativeMinor(amountMinor, 'amountMinor');
  if (originalCurrency === baseCurrency) {
    return {
      originalAmountMinor: amountMinor,
      originalCurrency,
      exchangeRate: '1.000000',
      rateSource: 'IDENTITY',
      baseAmountMinor: amountMinor,
    };
  }

  const hasManual = manualRate !== null && manualRate !== undefined && String(manualRate).trim() !== '';
  const exchangeRate = hasManual
    ? normalizeRateString(manualRate)
    : getDeterministicRate(originalCurrency, baseCurrency);
  const rateSource = hasManual ? 'MANUAL_OVERRIDE' : 'DETERMINISTIC_TABLE';
  const baseAmountMinor = convertMinorWithRate(amountMinor, exchangeRate);

  return {
    originalAmountMinor: amountMinor,
    originalCurrency,
    exchangeRate,
    rateSource,
    baseAmountMinor,
  };
}

/**
 * Deterministic Largest Remainder (Hamilton) distribution utility.
 * Ensures split shares ALWAYS sum exactly to totalMinor with zero floating-point error.
 *
 * @param {number} totalMinor - Non-negative integer minor units to distribute
 * @param {number|number[]} weightsOrCount - Number of equal participants OR array of positive weights
 * @returns {number[]} Array of integer minor units summing exactly to totalMinor
 */
export function distributeAmount(totalMinor, weightsOrCount) {
  assertNonNegativeMinor(totalMinor, 'totalMinor');

  let weights;
  if (typeof weightsOrCount === 'number') {
    if (!Number.isInteger(weightsOrCount) || weightsOrCount <= 0) {
      throw new Error('Participant count must be a positive integer');
    }
    weights = Array.from({ length: weightsOrCount }, () => 1n);
  } else if (Array.isArray(weightsOrCount)) {
    if (weightsOrCount.length === 0) {
      throw new Error('Weights array must not be empty');
    }
    // Scale weights by 10_000 so percentages like 33.33 work with exact integer math
    weights = weightsOrCount.map((w, idx) => {
      const str = typeof w === 'number' ? String(w) : String(w ?? '').trim();
      if (!/^\d+(\.\d+)?$/.test(str)) {
        throw new Error(`Invalid weight at index ${idx}: ${w}`);
      }
      const [intPart, fracPart = ''] = str.split('.');
      const scaled = BigInt(intPart) * 10000n + BigInt((fracPart + '0000').slice(0, 4));
      if (scaled <= 0n) {
        throw new Error(`Weight at index ${idx} must be positive`);
      }
      return scaled;
    });
  } else {
    throw new Error('weightsOrCount must be a positive integer or non-empty array');
  }

  const totalWeight = weights.reduce((acc, w) => acc + w, 0n);
  const totalBig = BigInt(totalMinor);

  const allocations = weights.map((weight, index) => {
    const numerator = totalBig * weight;
    const baseShare = numerator / totalWeight;
    const remainder = numerator % totalWeight;
    return { index, share: Number(baseShare), remainder };
  });

  const allocatedSum = allocations.reduce((acc, item) => acc + item.share, 0);
  let remaining = totalMinor - allocatedSum;

  const ranked = [...allocations].sort((a, b) => {
    if (b.remainder > a.remainder) return 1;
    if (b.remainder < a.remainder) return -1;
    return a.index - b.index;
  });

  for (let i = 0; i < remaining; i++) {
    ranked[i].share += 1;
  }

  return allocations.map((item) => item.share);
}

/**
 * Computes exact basis-point percentage of minor units (e.g., 1800 bps = 18.00%),
 * rounded half-up to the nearest integer minor unit.
 */
export function applyBps(amountMinor, bps) {
  assertNonNegativeMinor(amountMinor, 'amountMinor');
  if (!Number.isSafeInteger(bps) || bps < 0) {
    throw new Error('bps must be a non-negative integer');
  }
  return Number((BigInt(amountMinor) * BigInt(bps) + 5000n) / 10000n);
}

/**
 * Formats integer minor units to display string (e.g., 1050 INR -> "₹10.50")
 * using exact integer division and padding.
 */
export function formatMinor(amountMinor, currency = 'INR') {
  assertMinorInt(amountMinor, 'amountMinor');
  const meta = CURRENCY_META[currency] || { symbol: `${currency} `, code: currency };
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  const majorStr = major.toLocaleString('en-US');
  const minorStr = String(minor).padStart(2, '0');
  return `${negative ? '-' : ''}${meta.symbol}${majorStr}.${minorStr}`;
}
