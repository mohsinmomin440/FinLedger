import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { LedgerJournal } from '../../src/models/index.js';

const app = createApp();

describe('Expense Groups, Splits, Debt Simplification & Settlements', () => {
  it('splits expenses across EQUAL/EXACT/PERCENTAGE/SHARES, simplifies debts, and settles up in ACID tx', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice',
      email: 'alice-grp@finledger.io',
      password: 'Password123!',
      defaultCurrency: 'USD',
    });
    const token = reg.body.data.accessToken;

    const grpRes = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Goa Trip',
        currency: 'USD',
        members: [
          { name: 'Alice', email: 'alice-grp@finledger.io' },
          { name: 'Bob', email: 'bob@example.com' },
          { name: 'Carol', email: 'carol@example.com' },
        ],
      });

    expect(grpRes.status).toBe(201);
    const group = grpRes.body.data;
    const [alice, bob, carol] = group.members;

    // 1. Odd Equal split: 100 minor ($1.00) paid by Alice -> 34 + 33 + 33
    const exp1 = await request(app)
      .post(`/api/v1/groups/${group._id}/expenses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Water bottles',
        paidByMemberId: alice._id,
        originalAmountMinor: 100,
        splitType: 'EQUAL',
      });
    expect(exp1.status).toBe(201);
    expect(exp1.body.data.splits.map((s) => s.owedMinor)).toEqual([34, 33, 33]);

    // 2. Percentage split: 10000 minor ($100.00) paid by Bob (50% Alice, 25% Bob, 25% Carol)
    const exp2 = await request(app)
      .post(`/api/v1/groups/${group._id}/expenses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Dinner',
        paidByMemberId: bob._id,
        originalAmountMinor: 10000,
        splitType: 'PERCENTAGE',
        splits: [
          { memberId: alice._id, shareValue: 50 },
          { memberId: bob._id, shareValue: 25 },
          { memberId: carol._id, shareValue: 25 },
        ],
      });
    expect(exp2.status).toBe(201);

    // Balances check:
    // Alice: paid 100, owed 34 + 5000 = 5034 => -4934
    // Bob: paid 10000, owed 33 + 2500 = 2533 => +7467
    // Carol: paid 0, owed 33 + 2500 = 2533 => -2533
    const balRes = await request(app)
      .get(`/api/v1/groups/${group._id}/balances`)
      .set('Authorization', `Bearer ${token}`);
    expect(balRes.status).toBe(200);
    const { memberBalances, simplifiedDebts } = balRes.body.data;

    const sumBalances = memberBalances.reduce((a, b) => a + b.balanceMinor, 0);
    expect(sumBalances).toBe(0);
    expect(simplifiedDebts.length).toBe(2); // Alice -> Bob (4934), Carol -> Bob (2533)

    // Settle all simplified debts
    for (const debt of simplifiedDebts) {
      const settleRes = await request(app)
        .post(`/api/v1/groups/${group._id}/settlements`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          fromMemberId: debt.fromMemberId,
          toMemberId: debt.toMemberId,
          amountMinor: debt.amountMinor,
          note: 'Settled up',
        });
      expect(settleRes.status).toBe(201);
    }

    const finalBal = await request(app)
      .get(`/api/v1/groups/${group._id}/balances`)
      .set('Authorization', `Bearer ${token}`);
    expect(finalBal.body.data.simplifiedDebts).toEqual([]);
    expect(finalBal.body.data.memberBalances.every((m) => m.balanceMinor === 0)).toBe(true);

    // Settlement journals balanced
    const settlementJournals = await LedgerJournal.find({ referenceType: 'SETTLEMENT' });
    expect(settlementJournals.length).toBe(2);
    for (const j of settlementJournals) {
      const debits = j.entries.filter((e) => e.side === 'DEBIT').reduce((a, b) => a + b.amountMinor, 0);
      const credits = j.entries.filter((e) => e.side === 'CREDIT').reduce((a, b) => a + b.amountMinor, 0);
      expect(debits).toBe(credits);
    }
  });
});
