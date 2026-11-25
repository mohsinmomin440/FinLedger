import { Router } from 'express';
import * as recurringController from '../controllers/recurring.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { validate } from '../middleware/validate.js';
import {
  createRecurringRuleSchema,
  recurringRuleIdParamSchema,
  updateRecurringRuleSchema,
} from '../validators/recurring.validator.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireWorkspace('VIEWER'), recurringController.listRecurringRules);
router.post(
  '/',
  requireWorkspace('MEMBER'),
  validate(createRecurringRuleSchema),
  recurringController.createRecurringRule
);
router.patch(
  '/:id',
  requireWorkspace('MEMBER'),
  validate(updateRecurringRuleSchema),
  recurringController.updateRecurringRule
);
router.delete(
  '/:id',
  requireWorkspace('MEMBER'),
  validate(recurringRuleIdParamSchema),
  recurringController.deleteRecurringRule
);
router.post(
  '/:id/trigger',
  requireWorkspace('MEMBER'),
  validate(recurringRuleIdParamSchema),
  recurringController.triggerRecurringRule
);

export default router;
