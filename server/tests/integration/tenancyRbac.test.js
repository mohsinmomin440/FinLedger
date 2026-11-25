import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { getTestEmailInbox } from '../../src/services/email.service.js';

const app = createApp();

async function registerUser(name, email) {
  const res = await request(app).post('/api/v1/auth/register').send({
    name,
    email,
    password: 'Password123!',
    defaultCurrency: 'INR',
  });
  return res.body.data;
}

describe('Multi-Tenant Workspace & RBAC Isolation', () => {
  it('blocks cross-workspace reads and writes with 403/404', async () => {
    const alice = await registerUser('Alice', 'alice-rbac@finledger.io');
    const bob = await registerUser('Bob', 'bob-rbac@finledger.io');

    const aliceAccounts = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${alice.accessToken}`);
    const bankAcc = aliceAccounts.body.data.find((a) => a.subtype === 'BANK');

    const createdTx = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({
        type: 'EXPENSE',
        accountId: bankAcc._id,
        category: 'Software & SaaS',
        description: 'Cloud Hosting',
        originalAmountMinor: 5000,
      });
    expect(createdTx.status).toBe(201);

    // Bob trying to access Alice's workspace via x-workspace-id header -> 403
    const crossHeader = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .set('x-workspace-id', alice.workspace._id);
    expect(crossHeader.status).toBe(403);

    // Bob trying to void Alice's transaction in Bob's own workspace -> 404
    const crossDelete = await request(app)
      .delete(`/api/v1/transactions/${createdTx.body.data._id}`)
      .set('Authorization', `Bearer ${bob.accessToken}`);
    expect(crossDelete.status).toBe(404);
  });

  it('enforces VIEWER read-only, MEMBER mutation, and ADMIN invite/role management', async () => {
    const owner = await registerUser('Owner', 'owner-rbac@finledger.io');
    const viewer = await registerUser('Viewer', 'viewer-rbac@finledger.io');
    const member = await registerUser('Member', 'member-rbac@finledger.io');

    // Invite Viewer
    const invViewer = await request(app)
      .post('/api/v1/workspaces/members/invite')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'viewer-rbac@finledger.io', role: 'VIEWER' });
    expect(invViewer.status).toBe(201);

    const viewerToken = getTestEmailInbox().find(
      (m) => m.to === 'viewer-rbac@finledger.io' && m.meta?.type === 'WORKSPACE_INVITE'
    ).meta.token;

    await request(app)
      .post('/api/v1/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ token: viewerToken });

    // Invite Member
    await request(app)
      .post('/api/v1/workspaces/members/invite')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'member-rbac@finledger.io', role: 'MEMBER' });

    const memberToken = getTestEmailInbox().find(
      (m) => m.to === 'member-rbac@finledger.io' && m.meta?.type === 'WORKSPACE_INVITE'
    ).meta.token;

    await request(app)
      .post('/api/v1/workspaces/invitations/accept')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ token: memberToken });

    const ownerAccounts = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('x-workspace-id', owner.workspace._id);
    const bankAcc = ownerAccounts.body.data.find((a) => a.subtype === 'BANK');

    // VIEWER can read but cannot create transactions
    const viewerRead = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .set('x-workspace-id', owner.workspace._id);
    expect(viewerRead.status).toBe(200);

    const viewerWrite = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .set('x-workspace-id', owner.workspace._id)
      .send({
        type: 'EXPENSE',
        accountId: bankAcc._id,
        category: 'Other',
        description: 'Unauthorized write',
        originalAmountMinor: 1000,
      });
    expect(viewerWrite.status).toBe(403);

    // MEMBER can create transactions but cannot invite users
    const memberWrite = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .set('x-workspace-id', owner.workspace._id)
      .send({
        type: 'EXPENSE',
        accountId: bankAcc._id,
        category: 'Other',
        description: 'Member expense',
        originalAmountMinor: 1000,
      });
    expect(memberWrite.status).toBe(201);

    const memberInvite = await request(app)
      .post('/api/v1/workspaces/members/invite')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .set('x-workspace-id', owner.workspace._id)
      .send({ email: 'another@finledger.io', role: 'VIEWER' });
    expect(memberInvite.status).toBe(403);
  });
});
