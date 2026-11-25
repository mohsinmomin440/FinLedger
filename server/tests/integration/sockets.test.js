import http from 'node:http';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../../src/app.js';
import { initSocketServer } from '../../src/sockets/index.js';
import { setSocketServer } from '../../src/services/notification.service.js';

describe('Socket.IO JWT Authentication & Workspace Room Authorization', () => {
  let httpServer = null;
  let io = null;
  const clients = [];

  afterEach(async () => {
    for (const c of clients) {
      c.disconnect();
    }
    clients.length = 0;
    setSocketServer(null);
    if (io) {
      await io.close();
      io = null;
    }
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
      httpServer = null;
    }
  });

  it('rejects unauthenticated handshakes, enforces workspace membership on join, and emits live events', async () => {
    const app = createApp();
    httpServer = http.createServer(app);
    io = initSocketServer(httpServer);

    await new Promise((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address();
    const url = `http://localhost:${port}`;

    // Register Alice & Bob
    const aliceReg = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice Socket',
      email: 'alice-ws@finledger.io',
      password: 'Password123!',
    });
    const bobReg = await request(app).post('/api/v1/auth/register').send({
      name: 'Bob Socket',
      email: 'bob-ws@finledger.io',
      password: 'Password123!',
    });

    const aliceToken = aliceReg.body.data.accessToken;
    const aliceWsId = aliceReg.body.data.workspace._id;
    const bobToken = bobReg.body.data.accessToken;

    // 1. Unauthenticated connection fails
    const unauthErr = await new Promise((resolve) => {
      const c = ioClient(url, { transports: ['websocket'], reconnection: false });
      clients.push(c);
      c.on('connect_error', (err) => resolve(err.message));
    });
    expect(unauthErr).toMatch(/authentication/i);

    // 2. Bob tries to join Alice's workspace room -> forbidden ack
    const bobClient = await new Promise((resolve, reject) => {
      const c = ioClient(url, {
        auth: { token: bobToken },
        transports: ['websocket'],
        reconnection: false,
      });
      clients.push(c);
      c.on('connect', () => resolve(c));
      c.on('connect_error', reject);
    });

    const bobJoinAck = await new Promise((resolve) => {
      bobClient.emit('workspace:join', aliceWsId, resolve);
    });
    expect(bobJoinAck.ok).toBe(false);

    // 3. Alice joins her own workspace and receives transaction:created live event
    const aliceClient = await new Promise((resolve, reject) => {
      const c = ioClient(url, {
        auth: { token: aliceToken, workspaceId: aliceWsId },
        transports: ['websocket'],
        reconnection: false,
      });
      clients.push(c);
      c.on('connect', () => resolve(c));
      c.on('connect_error', reject);
    });

    const aliceJoinAck = await new Promise((resolve) => {
      aliceClient.emit('workspace:join', aliceWsId, resolve);
    });
    expect(aliceJoinAck.ok).toBe(true);

    const accRes = await request(app)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${aliceToken}`);
    const bank = accRes.body.data.find((a) => a.subtype === 'BANK');

    const eventPromise = new Promise((resolve) => {
      aliceClient.once('transaction:created', resolve);
    });

    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        type: 'INCOME',
        accountId: bank._id,
        category: 'Salary',
        description: 'Socket Live Ping',
        originalAmountMinor: 5000,
      });

    const received = await eventPromise;
    expect(received.description).toBe('Socket Live Ping');
  });
});
