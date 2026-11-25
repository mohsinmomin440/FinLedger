import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './auth.routes.js';
import workspaceRoutes from './workspace.routes.js';
import accountRoutes from './account.routes.js';
import ledgerRoutes from './ledger.routes.js';
import transactionRoutes from './transaction.routes.js';
import budgetRoutes from './budget.routes.js';
import groupRoutes from './group.routes.js';
import clientRoutes from './client.routes.js';
import invoiceRoutes from './invoice.routes.js';
import recurringRoutes from './recurring.routes.js';
import receiptRoutes from './receipt.routes.js';
import analyticsRoutes from './analytics.routes.js';
import notificationRoutes from './notification.routes.js';
import { sendSuccess } from '../utils/ApiResponse.js';

const router = Router();

router.get('/health', (_req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return sendSuccess(res, {
    message: 'FinLedger API healthy',
    data: {
      status: 'ok',
      dbState: dbStates[mongoose.connection.readyState] || 'unknown',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/accounts', accountRoutes);
router.use('/ledger', ledgerRoutes);
router.use('/transactions', transactionRoutes);
router.use('/budgets', budgetRoutes);
router.use('/groups', groupRoutes);
router.use('/clients', clientRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/recurring', recurringRoutes);
router.use('/receipts', receiptRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationRoutes);

export default router;
