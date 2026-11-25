import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';

const app = createApp();

// Valid 1x1 PNG signature bytes
const VALID_PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

describe('Private Receipt Uploads & Access Control', () => {
  it('accepts valid PNG upload, streams only to workspace members, and rejects SVG/spoofed files', async () => {
    const aliceReg = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice Receipt',
      email: 'alice-rec@finledger.io',
      password: 'Password123!',
    });
    const bobReg = await request(app).post('/api/v1/auth/register').send({
      name: 'Bob Receipt',
      email: 'bob-rec@finledger.io',
      password: 'Password123!',
    });

    const aliceToken = aliceReg.body.data.accessToken;
    const bobToken = bobReg.body.data.accessToken;

    // Upload valid PNG
    const uploadRes = await request(app)
      .post('/api/v1/receipts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .attach('file', VALID_PNG_BYTES, { filename: 'receipt.png', contentType: 'image/png' });

    expect(uploadRes.status).toBe(201);
    const receiptId = uploadRes.body.data._id;

    // Owner can stream receipt
    const downloadOk = await request(app)
      .get(`/api/v1/receipts/${receiptId}/file`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(downloadOk.status).toBe(200);
    expect(downloadOk.headers['content-type']).toBe('image/png');

    // Cross-workspace user gets 404 (not in their workspace)
    const downloadCross = await request(app)
      .get(`/api/v1/receipts/${receiptId}/file`)
      .set('Authorization', `Bearer ${bobToken}`);
    expect(downloadCross.status).toBe(404);

    // Reject SVG XSS payload
    const svgReject = await request(app)
      .post('/api/v1/receipts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .attach('file', Buffer.from('<svg onload=alert(1)></svg>'), {
        filename: 'evil.svg',
        contentType: 'image/svg+xml',
      });
    expect(svgReject.status).toBe(400);

    // Reject spoofed .png with invalid magic bytes
    const spoofReject = await request(app)
      .post('/api/v1/receipts')
      .set('Authorization', `Bearer ${aliceToken}`)
      .attach('file', Buffer.from('MZ_EXECUTABLE_BYTES'), {
        filename: 'fake.png',
        contentType: 'image/png',
      });
    expect(spoofReject.status).toBe(400);
    expect(spoofReject.body.code).toBe('INVALID_FILE_SIGNATURE');
  });
});
