import { Router } from 'express';
import * as accountController from '../controllers/account.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { validate } from '../middleware/validate.js';
import { listLedgerQuerySchema } from '../validators/account.validator.js';

const router = Router();

router.use(requireAuth, requireWorkspace('VIEWER'));
router.get('/journals', validate(listLedgerQuerySchema), accountController.listLedgerJournals);
router.get('/entries', validate(listLedgerQuerySchema), accountController.listLedgerEntries);

export default router;
