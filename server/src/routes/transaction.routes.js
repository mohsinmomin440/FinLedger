import { Router } from 'express';
import * as transactionController from '../controllers/transaction.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { validate } from '../middleware/validate.js';
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  transactionIdParamSchema,
  updateTransactionSchema,
} from '../validators/transaction.validator.js';

const router = Router();

router.use(requireAuth);
router.get('/export/csv', requireWorkspace('VIEWER'), transactionController.exportCsv);
router.get(
  '/',
  requireWorkspace('VIEWER'),
  validate(listTransactionsQuerySchema),
  transactionController.listTransactions
);
router.post(
  '/',
  requireWorkspace('MEMBER'),
  validate(createTransactionSchema),
  transactionController.createTransaction
);
router.patch(
  '/:id',
  requireWorkspace('MEMBER'),
  validate(updateTransactionSchema),
  transactionController.updateTransaction
);
router.delete(
  '/:id',
  requireWorkspace('MEMBER'),
  validate(transactionIdParamSchema),
  transactionController.deleteTransaction
);

export default router;
