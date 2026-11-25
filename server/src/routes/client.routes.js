import { Router } from 'express';
import * as invoiceController from '../controllers/invoice.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { validate } from '../middleware/validate.js';
import {
  clientIdParamSchema,
  createClientSchema,
  updateClientSchema,
} from '../validators/invoice.validator.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireWorkspace('VIEWER'), invoiceController.listClients);
router.post('/', requireWorkspace('MEMBER'), validate(createClientSchema), invoiceController.createClient);
router.patch('/:id', requireWorkspace('MEMBER'), validate(updateClientSchema), invoiceController.updateClient);
router.delete('/:id', requireWorkspace('MEMBER'), validate(clientIdParamSchema), invoiceController.deleteClient);

export default router;
