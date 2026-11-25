import { Router } from 'express';
import * as invoiceController from '../controllers/invoice.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { validate } from '../middleware/validate.js';
import {
  createInvoiceSchema,
  invoiceIdParamSchema,
  recordInvoicePaymentSchema,
  updateInvoiceSchema,
} from '../validators/invoice.validator.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireWorkspace('VIEWER'), invoiceController.listInvoices);
router.post('/', requireWorkspace('MEMBER'), validate(createInvoiceSchema), invoiceController.createInvoice);
router.get('/:id', requireWorkspace('VIEWER'), validate(invoiceIdParamSchema), invoiceController.getInvoice);
router.patch('/:id', requireWorkspace('MEMBER'), validate(updateInvoiceSchema), invoiceController.updateInvoice);
router.post('/:id/send', requireWorkspace('MEMBER'), validate(invoiceIdParamSchema), invoiceController.sendInvoice);
router.post('/:id/void', requireWorkspace('MEMBER'), validate(invoiceIdParamSchema), invoiceController.voidInvoice);
router.post(
  '/:id/payments',
  requireWorkspace('MEMBER'),
  validate(recordInvoicePaymentSchema),
  invoiceController.recordPayment
);
router.get(
  '/:id/pdf',
  requireWorkspace('VIEWER'),
  validate(invoiceIdParamSchema),
  invoiceController.downloadInvoicePdf
);

export default router;
