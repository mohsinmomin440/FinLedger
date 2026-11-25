import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { RefreshToken } from '../../src/models/index.js';
import { getTestEmailInbox } from '../../src/services/email.service.js';

const app = createApp();

function extractCookie(setCookieHeaders, name) {
  const header = (setCookieHeaders || []).find((c) => c.startsWith(`${name}=`));
  if (!header) return null;
  return header.split(';')[0].split('=')[1];
}

describe('Auth, Refresh Rotation, Reuse Detection & CSRF', () => {
  it('registers user with auto-provisioned workspace and starter ledger accounts', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Ada Lovelace',
      email: 'ada@finledger.io',
      password: 'Password123!',
      defaultCurrency: 'USD',
      workspaceName: 'Ada Analytics',
      workspaceType: 'BUSINESS',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.workspace.baseCurrency).toBe('USD');

    const cookies = res.headers['set-cookie'];
    expect(extractCookie(cookies, 'finledger_refresh')).toBeTruthy();
    expect(extractCookie(cookies, 'finledger_csrf')).toBeTruthy();

    const accountsRes = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`);
    expect(accountsRes.status).toBe(200);
    expect(accountsRes.body.data.length).toBeGreaterThanOrEqual(8);
  });

  it('enforces CSRF double-submit on /auth/refresh, /auth/logout, and /auth/sessions and supports /auth/csrf bootstrap', async () => {
    const agent = request.agent(app);
    const reg = await agent.post('/api/v1/auth/register').send({
      name: 'Grace Hopper',
      email: 'grace@finledger.io',
      password: 'Password123!',
    });

    const csrfToken = reg.body.data.csrfToken;
    const accessToken = reg.body.data.accessToken;

    const csrfBoot = await agent.get('/api/v1/auth/csrf');
    expect(csrfBoot.status).toBe(200);
    expect(csrfBoot.body.data.hasSession).toBe(true);
    expect(csrfBoot.body.data.csrfToken).toBe(csrfToken);

    const badRefresh = await agent.post('/api/v1/auth/refresh');
    expect(badRefresh.status).toBe(403);
    expect(badRefresh.body.code).toBe('CSRF_INVALID');

    const badSessions = await agent
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(badSessions.status).toBe(403);

    const goodSessions = await agent
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-CSRF-Token', csrfToken);
    expect(goodSessions.status).toBe(200);
    expect(goodSessions.body.data.length).toBe(1);
  });

  it('rotates refresh tokens and revokes entire family on reuse detection', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Alan Turing',
      email: 'alan@finledger.io',
      password: 'Password123!',
    });

    const cookies1 = reg.headers['set-cookie'];
    const csrf1 = extractCookie(cookies1, 'finledger_csrf');
    const refresh1 = extractCookie(cookies1, 'finledger_refresh');

    const ref1Res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`finledger_refresh=${refresh1}`, `finledger_csrf=${csrf1}`])
      .set('X-CSRF-Token', csrf1);

    expect(ref1Res.status).toBe(200);
    const cookies2 = ref1Res.headers['set-cookie'];
    const csrf2 = extractCookie(cookies2, 'finledger_csrf');
    const refresh2 = extractCookie(cookies2, 'finledger_refresh');
    expect(refresh2).not.toBe(refresh1);

    const replayRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`finledger_refresh=${refresh1}`, `finledger_csrf=${csrf1}`])
      .set('X-CSRF-Token', csrf1);

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.code).toBe('REFRESH_TOKEN_REUSE');

    const ref2AfterRevoke = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`finledger_refresh=${refresh2}`, `finledger_csrf=${csrf2}`])
      .set('X-CSRF-Token', csrf2);

    expect(ref2AfterRevoke.status).toBe(401);
    const activeCount = await RefreshToken.countDocuments({ revokedAt: null });
    expect(activeCount).toBe(0);
  });

  it('supports email verification and forgot/reset password flows', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      name: 'Katherine Johnson',
      email: 'kj@finledger.io',
      password: 'Password123!',
    });

    const inbox = getTestEmailInbox();
    const verifyMail = inbox.find((m) => m.meta?.type === 'VERIFY_EMAIL');
    expect(verifyMail).toBeTruthy();

    const verifyRes = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: verifyMail.meta.token });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.user.emailVerified).toBe(true);

    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'kj@finledger.io' });
    const resetMail = getTestEmailInbox().find((m) => m.meta?.type === 'PASSWORD_RESET');
    expect(resetMail).toBeTruthy();

    const resetRes = await request(app).post('/api/v1/auth/reset-password').send({
      token: resetMail.meta.token,
      password: 'NewPassword456!',
    });
    expect(resetRes.status).toBe(200);

    const oldLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'kj@finledger.io',
      password: 'Password123!',
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'kj@finledger.io',
      password: 'NewPassword456!',
    });
    expect(newLogin.status).toBe(200);
    expect(reg.body.data.user.email).toBe('kj@finledger.io');
  });
});
