import { Router } from 'express';
import * as workspaceController from '../controllers/workspace.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireWorkspace } from '../middleware/workspace.js';
import { validate } from '../middleware/validate.js';
import {
  acceptInvitationSchema,
  createWorkspaceSchema,
  inviteMemberSchema,
  memberIdParamSchema,
  switchWorkspaceSchema,
  updateMemberRoleSchema,
  updateWorkspaceSchema,
} from '../validators/workspace.validator.js';

const router = Router();

router.use(requireAuth);

router.get('/', workspaceController.listWorkspaces);
router.post('/', validate(createWorkspaceSchema), workspaceController.createWorkspace);
router.post(
  '/:workspaceId/switch',
  validate(switchWorkspaceSchema),
  workspaceController.switchWorkspace
);
router.post(
  '/invitations/accept',
  validate(acceptInvitationSchema),
  workspaceController.acceptInvitation
);

router.patch(
  '/current',
  requireWorkspace('ADMIN'),
  validate(updateWorkspaceSchema),
  workspaceController.updateCurrentWorkspace
);

router.get('/members', requireWorkspace('VIEWER'), workspaceController.listMembers);
router.get('/current/members', requireWorkspace('VIEWER'), workspaceController.listMembers);

router.post(
  '/members/invite',
  requireWorkspace('ADMIN'),
  validate(inviteMemberSchema),
  workspaceController.inviteMember
);
router.post(
  '/current/members/invite',
  requireWorkspace('ADMIN'),
  validate(inviteMemberSchema),
  workspaceController.inviteMember
);

router.patch(
  '/members/:memberId',
  requireWorkspace('ADMIN'),
  validate(updateMemberRoleSchema),
  workspaceController.updateMemberRole
);
router.patch(
  '/current/members/:memberId',
  requireWorkspace('ADMIN'),
  validate(updateMemberRoleSchema),
  workspaceController.updateMemberRole
);

router.delete(
  '/members/:memberId',
  requireWorkspace('ADMIN'),
  validate(memberIdParamSchema),
  workspaceController.removeMember
);
router.delete(
  '/current/members/:memberId',
  requireWorkspace('ADMIN'),
  validate(memberIdParamSchema),
  workspaceController.removeMember
);

export default router;
