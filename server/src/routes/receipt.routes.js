import { Router } from 'express';
import * as receiptController from '../controllers/receipt.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { receiptUpload } from '../middleware/upload.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireWorkspace('VIEWER'), receiptController.listReceipts);
router.post(
  '/',
  requireWorkspace('MEMBER'),
  receiptUpload.single('file'),
  receiptController.uploadReceipt
);
router.get('/:id/file', requireWorkspace('VIEWER'), receiptController.streamReceiptFile);
router.delete('/:id', requireWorkspace('MEMBER'), receiptController.deleteReceipt);

export default router;
