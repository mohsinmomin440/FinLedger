import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { Transaction } from '../../src/models/index.js';
import { processDueRecurringRules } from '../../src/services/recurring.service.js';

const app = createApp();

describe('Analytics, Budgets, Formula-Safe CSV, Monthly PDF & Recurring Idempotency', () => {
  it('triggers budget alert notifications, exports formula-safe CSV & monthly PDF, and guarantees recurring idempotency', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Analytics User',
      email: 'analytics@finledger.io',
      password: 'Password123!',
      defaultCurrency: 'INR',
    });
    const token = reg.body.data.accessToken;

    const accRes = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`);
    const bank = accRes.body.data.find((a) => a.subtype === 'BANK');

    const monthKey = new Date().toISOString().slice(0, 7);

    // Create budget of ₹100.00 (10000 minor) for Food & Dining with 80% threshold
    const budgetRes = await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'Food & Dining',
        monthKey,
        limitMinor: 10000,
        alertThresholdPercent: 80,
      });
    expect(budgetRes.status).toBe(201);

    // Expense with dangerous spreadsheet formula payload + crossing 80% threshold (8500 minor)
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'EXPENSE',
        accountId: bank._id,
        category: 'Food & Dining',
        description: '=CMD("calc")',
        originalAmountMinor: 8500,
      });

    const notifRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(notifRes.status).toBe(200);
    expect(notifRes.body.data.items.some((n) => n.type === 'BUDGET_ALERT')).toBe(true);

    // Formula-safe CSV export check
    const csvRes = await request(app)
      .get('/api/v1/analytics/export/csv')
      .set('Authorization', `Bearer ${token}`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.text).toContain('\'=CMD(""calc"")');

    // Monthly statement PDF check
    const pdfRes = await request(app)
      .get(`/api/v1/analytics/statement/pdf?monthKey=${monthKey}`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.body.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    // Recurring rule idempotency test: due 1 minute ago
    const pastDue = new Date(Date.now() - 60_000).toISOString();
    const recRes = await request(app)
      .post('/api/v1/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Cloud Rent',
        kind: 'TRANSACTION',
        frequency: 'MONTHLY',
        nextRunAt: pastDue,
        templatePayload: {
          type: 'EXPENSE',
          accountId: bank._id,
          category: 'Software & SaaS',
          description: 'Monthly VPS',
          originalAmountMinor: 2500,
        },
      });
    expect(recRes.status).toBe(201);

    const now = new Date();
    const run1 = await processDueRecurringRules(now);
    const run2 = await processDueRecurringRules(now);

    expect(run1.length).toBe(1);
    expect(run2.length).toBe(0);

    const spawnedTxs = await Transaction.find({ recurringRuleId: recRes.body.data._id });
    expect(spawnedTxs.length).toBe(1);
  });
});
