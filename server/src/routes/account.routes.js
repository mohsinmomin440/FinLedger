import { Router } from 'express';
import * as accountController from '../controllers/account.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { validate } from '../middleware/validate.js';
import { createAccountSchema, updateAccountSchema } from '../validators/account.validator.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireWorkspace('VIEWER'), accountController.listAccounts);
router.post('/', requireWorkspace('ADMIN'), validate(createAccountSchema), accountController.createAccount);
router.patch('/:id', requireWorkspace('ADMIN'), validate(updateAccountSchema), accountController.updateAccount);

export default router;
