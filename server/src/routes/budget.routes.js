import { Router } from 'express';
import * as budgetController from '../controllers/budget.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { validate } from '../middleware/validate.js';
import {
  budgetIdParamSchema,
  listBudgetsQuerySchema,
  upsertBudgetSchema,
} from '../validators/budget.validator.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireWorkspace('VIEWER'), validate(listBudgetsQuerySchema), budgetController.listBudgets);
router.post('/', requireWorkspace('MEMBER'), validate(upsertBudgetSchema), budgetController.upsertBudget);
router.delete('/:id', requireWorkspace('MEMBER'), validate(budgetIdParamSchema), budgetController.deleteBudget);

export default router;
