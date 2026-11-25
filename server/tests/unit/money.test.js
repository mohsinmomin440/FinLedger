import { describe, it, expect } from 'vitest';
import {
  applyBps,
  convertMinorWithRate,
  distributeAmount,
  formatMinor,
  resolveFxConversion,
} from '../../src/utils/money.js';
import { loadEnv } from '../../src/config/env.js';

describe('Money & Minor-Unit Utilities', () => {
  it('distributes odd minor totals equally using Largest Remainder (100 / 3 -> 34 + 33 + 33)', () => {
    const splits = distributeAmount(100, 3);
    expect(splits).toEqual([34, 33, 33]);
    expect(splits.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('distributes percentage weights with exact sum preservation', () => {
    const splits = distributeAmount(10001, [33.33, 33.33, 33.34]);
    expect(splits.reduce((a, b) => a + b, 0)).toBe(10001);
    expect(splits.every((n) => Number.isSafeInteger(n))).toBe(true);
  });

  it('distributes share weights accurately', () => {
    const splits = distributeAmount(1000, [1, 2, 1]);
    expect(splits).toEqual([250, 500, 250]);
  });

  it('handles zero minor total cleanly', () => {
    expect(distributeAmount(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it('computes exact integer FX conversions without floating-point drift', () => {
    expect(convertMinorWithRate(1050, '84.000000')).toBe(88200);
    const fx = resolveFxConversion({
      amountMinor: 1000,
      originalCurrency: 'USD',
      baseCurrency: 'INR',
    });
    expect(fx.baseAmountMinor).toBe(84000);
    expect(fx.rateSource).toBe('DETERMINISTIC_TABLE');

    const manual = resolveFxConversion({
      amountMinor: 1000,
      originalCurrency: 'USD',
      baseCurrency: 'INR',
      manualRate: '85.5',
    });
    expect(manual.baseAmountMinor).toBe(85500);
    expect(manual.rateSource).toBe('MANUAL_OVERRIDE');
  });

  it('computes basis-point tax cleanly and formats minor units', () => {
    expect(applyBps(10000, 1800)).toBe(1800);
    expect(applyBps(333, 1800)).toBe(60);
    expect(formatMinor(1050, 'INR')).toBe('₹10.50');
    expect(formatMinor(-2505, 'USD')).toBe('-$25.05');
  });

  it('fails fast in production when required secrets or MONGO_URI are missing', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        USE_MEMORY_DB: 'true',
      })
    ).toThrow(/USE_MEMORY_DB/);

    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        MONGO_URI: '',
      })
    ).toThrow(/MONGO_URI/);

    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        MONGO_URI: 'mongodb+srv://cluster/db',
        JWT_ACCESS_SECRET: 'short',
      })
    ).toThrow(/JWT_ACCESS_SECRET/);
  });
});
