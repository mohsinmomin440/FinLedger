import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { LedgerEntry, LedgerJournal } from '../../src/models/index.js';

const app = createApp();

describe('Double-Entry Ledger & Transactions ACID Integration', () => {
  it('posts balanced journals, preserves FX snapshots, and creates reversing entries on edit/void', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Ledger Tester',
      email: 'ledger@finledger.io',
      password: 'Password123!',
      defaultCurrency: 'INR',
    });
    const token = reg.body.data.accessToken;

    const accRes = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`);
    const bank = accRes.body.data.find((a) => a.subtype === 'BANK');
    const cash = accRes.body.data.find((a) => a.subtype === 'CASH');

    // 1. Income: ₹1000.00 (100000 minor) into Primary Bank
    const incRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'INCOME',
        accountId: bank._id,
        category: 'Salary',
        description: 'Monthly salary',
        originalAmountMinor: 100000,
      });
    expect(incRes.status).toBe(201);

    // 2. Foreign Currency Expense: $10.00 USD -> ₹840.00 INR (84000 minor)
    const expRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'EXPENSE',
        accountId: bank._id,
        category: 'Software & SaaS',
        description: 'Cloud IDE',
        originalAmountMinor: 1000,
        originalCurrency: 'USD',
      });
    expect(expRes.status).toBe(201);
    expect(expRes.body.data.baseAmountMinor).toBe(84000);
    expect(expRes.body.data.exchangeRate).toBe('84.000000');

    // 3. Transfer: ₹100.00 (10000 minor) from Bank -> Cash
    const trRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'TRANSFER',
        accountId: bank._id,
        toAccountId: cash._id,
        category: 'Transfer',
        description: 'ATM Withdrawal',
        originalAmountMinor: 10000,
      });
    expect(trRes.status).toBe(201);

    // Check balances: Bank = 100000 - 84000 - 10000 = 6000; Cash = 10000
    const accAfter = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`);
    const bankAfter = accAfter.body.data.find((a) => a._id === bank._id);
    const cashAfter = accAfter.body.data.find((a) => a._id === cash._id);
    expect(bankAfter.balanceMinor).toBe(6000);
    expect(cashAfter.balanceMinor).toBe(10000);

    // Edit expense to $5.00 USD (42000 INR) -> generates reversal + new journal
    const editRes = await request(app)
      .patch(`/api/v1/transactions/${expRes.body.data._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ originalAmountMinor: 500 });
    expect(editRes.status).toBe(200);
    expect(editRes.body.data.baseAmountMinor).toBe(42000);

    // Void the edited expense -> generates another reversing journal
    const voidRes = await request(app)
      .delete(`/api/v1/transactions/${expRes.body.data._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(voidRes.status).toBe(200);
    expect(voidRes.body.data.reversalJournal.referenceType).toBe('REVERSAL');

    // After voiding expense, Bank should be 100000 - 10000 = 90000
    const accFinal = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`);
    const bankFinal = accFinal.body.data.find((a) => a._id === bank._id);
    expect(bankFinal.balanceMinor).toBe(90000);

    // Verify EVERY single LedgerJournal & LedgerEntry obeys SUM(DEBIT) === SUM(CREDIT)
    const journals = await LedgerJournal.find({});
    expect(journals.length).toBe(6); // income + exp + transfer + edit-rev + edit-new + void-rev
    for (const j of journals) {
      const debits = j.entries
        .filter((e) => e.side === 'DEBIT')
        .reduce((a, b) => a + b.amountMinor, 0);
      const credits = j.entries
        .filter((e) => e.side === 'CREDIT')
        .reduce((a, b) => a + b.amountMinor, 0);
      expect(debits).toBe(credits);
      expect(debits).toBe(j.totalMinor);
    }

    const entries = await LedgerEntry.find({});
    const totalDebits = entries
      .filter((e) => e.side === 'DEBIT')
      .reduce((a, b) => a + b.amountMinor, 0);
    const totalCredits = entries
      .filter((e) => e.side === 'CREDIT')
      .reduce((a, b) => a + b.amountMinor, 0);
    expect(totalDebits).toBe(totalCredits);
  });
});
