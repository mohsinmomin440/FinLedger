import { Router } from 'express';
import * as groupController from '../controllers/group.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { validate } from '../middleware/validate.js';
import {
  addGroupExpenseSchema,
  addGroupMemberSchema,
  createGroupSchema,
  groupExpenseIdParamSchema,
  groupIdParamSchema,
  recordSettlementSchema,
  updateGroupExpenseSchema,
} from '../validators/group.validator.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireWorkspace('VIEWER'), groupController.listGroups);
router.post('/', requireWorkspace('MEMBER'), validate(createGroupSchema), groupController.createGroup);
router.get('/:id/balances', requireWorkspace('VIEWER'), validate(groupIdParamSchema), groupController.getGroupBalances);
router.post('/:id/members', requireWorkspace('MEMBER'), validate(addGroupMemberSchema), groupController.addMember);
router.post('/:id/expenses', requireWorkspace('MEMBER'), validate(addGroupExpenseSchema), groupController.addExpense);
router.patch(
  '/:id/expenses/:expenseId',
  requireWorkspace('MEMBER'),
  validate(updateGroupExpenseSchema),
  groupController.updateExpense
);
router.delete(
  '/:id/expenses/:expenseId',
  requireWorkspace('MEMBER'),
  validate(groupExpenseIdParamSchema),
  groupController.deleteExpense
);
router.post('/:id/settlements', requireWorkspace('MEMBER'), validate(recordSettlementSchema), groupController.settleUp);

export default router;
