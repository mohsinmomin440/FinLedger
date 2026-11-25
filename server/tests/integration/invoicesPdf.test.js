import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('Clients, Invoice Lifecycle, Payments & PDFKit Generation', () => {
  it('completes DRAFT -> SENT -> PARTIAL -> PAID lifecycle and returns valid %PDF- bytes', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Studio Owner',
      email: 'studio@finledger.io',
      password: 'Password123!',
      defaultCurrency: 'USD',
      workspaceType: 'BUSINESS',
    });
    const token = reg.body.data.accessToken;

    const clientRes = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Acme Corp',
        email: 'billing@acme.test',
        company: 'Acme Inc.',
        defaultCurrency: 'USD',
      });
    expect(clientRes.status).toBe(201);

    const dueDate = new Date(Date.now() + 14 * 86400 * 1000).toISOString();
    const invRes = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: clientRes.body.data._id,
        dueDate,
        currency: 'USD',
        lineItems: [
          { description: 'Architecture Consulting', qty: 2, unitPriceMinor: 50000, taxRateBps: 1000 },
        ],
        discountMinor: 5000,
      });

    expect(invRes.status).toBe(201);
    const inv = invRes.body.data;
    // 2 * 50000 = 100000 subtotal; 10% tax = 10000; discount = 5000 => total = 105000
    expect(inv.subtotalMinor).toBe(100000);
    expect(inv.taxMinor).toBe(10000);
    expect(inv.totalMinor).toBe(105000);
    expect(inv.status).toBe('DRAFT');

    // Send invoice -> SENT
    const sendRes = await request(app)
      .post(`/api/v1/invoices/${inv._id}/send`)
      .set('Authorization', `Bearer ${token}`);
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.data.status).toBe('SENT');

    // Partial payment -> PARTIAL
    const pay1Res = await request(app)
      .post(`/api/v1/invoices/${inv._id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountMinor: 40000, method: 'WIRE', reference: 'TXN-1' });
    expect(pay1Res.status).toBe(201);
    expect(pay1Res.body.data.status).toBe('PARTIAL');
    expect(pay1Res.body.data.paidMinor).toBe(40000);

    // Final payment -> PAID
    const pay2Res = await request(app)
      .post(`/api/v1/invoices/${inv._id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountMinor: 65000, method: 'WIRE', reference: 'TXN-2' });
    expect(pay2Res.status).toBe(201);
    expect(pay2Res.body.data.status).toBe('PAID');
    expect(pay2Res.body.data.paidMinor).toBe(105000);

    // Primary Bank should have 105000, Accounts Receivable should be 0
    const accRes = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`);
    const bank = accRes.body.data.find((a) => a.subtype === 'BANK');
    const ar = accRes.body.data.find((a) => a.subtype === 'RECEIVABLE');
    expect(bank.balanceMinor).toBe(105000);
    expect(ar.balanceMinor).toBe(0);

    // Download PDF invoice
    const pdfRes = await request(app)
      .get(`/api/v1/invoices/${inv._id}/pdf`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(pdfRes.body.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
