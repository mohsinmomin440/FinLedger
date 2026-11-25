import { describe, it, expect } from 'vitest';
import { simplifyGroupDebts } from '../../src/utils/debtSimplifier.js';

describe('Debt Simplification Algorithm (Minimum Cash-Flow)', () => {
  it('throws when balances violate zero-sum invariant', () => {
    expect(() =>
      simplifyGroupDebts([
        { memberId: 'a', balanceMinor: 500 },
        { memberId: 'b', balanceMinor: -400 },
      ])
    ).toThrow(/zero-sum/i);
  });

  it('simplifies multi-member balances while preserving net cash-flow', () => {
    const balances = [
      { memberId: 'alice', name: 'Alice', balanceMinor: 6000 },
      { memberId: 'bob', name: 'Bob', balanceMinor: -2500 },
      { memberId: 'carol', name: 'Carol', balanceMinor: -3500 },
      { memberId: 'dave', name: 'Dave', balanceMinor: 0 },
    ];

    const transfers = simplifyGroupDebts(balances);
    expect(transfers.length).toBeLessThanOrEqual(2);

    const netAfter = new Map([
      ['alice', 0],
      ['bob', 0],
      ['carol', 0],
      ['dave', 0],
    ]);

    for (const t of transfers) {
      expect(t.amountMinor).toBeGreaterThan(0);
      netAfter.set(t.fromMemberId, netAfter.get(t.fromMemberId) - t.amountMinor);
      netAfter.set(t.toMemberId, netAfter.get(t.toMemberId) + t.amountMinor);
    }

    for (const b of balances) {
      expect(netAfter.get(b.memberId)).toBe(b.balanceMinor);
    }
  });

  it('returns empty transfers when everyone is settled', () => {
    expect(
      simplifyGroupDebts([
        { memberId: 'a', balanceMinor: 0 },
        { memberId: 'b', balanceMinor: 0 },
      ])
    ).toEqual([]);
  });
});
