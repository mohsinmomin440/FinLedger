import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as workspaceService from '../services/workspace.service.js';

export const listWorkspaces = asyncHandler(async (req, res) => {
  const workspaces = await workspaceService.listUserWorkspaces(req.user._id);
  return sendSuccess(res, { data: workspaces });
});

export const createWorkspace = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.createWorkspace(req.user._id, req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Workspace created',
    data: workspace,
  });
});

export const switchWorkspace = asyncHandler(async (req, res) => {
  const data = await workspaceService.switchWorkspace(req.user._id, req.params.workspaceId);
  return sendSuccess(res, { message: 'Workspace switched', data });
});

export const updateCurrentWorkspace = asyncHandler(async (req, res) => {
  const updated = await workspaceService.updateWorkspace(req.workspace._id, req.body);
  return sendSuccess(res, { message: 'Workspace updated', data: updated });
});

export const listMembers = asyncHandler(async (req, res) => {
  const data = await workspaceService.listWorkspaceMembers(req.workspace._id);
  return sendSuccess(res, { data });
});

export const inviteMember = asyncHandler(async (req, res) => {
  const invitation = await workspaceService.inviteWorkspaceMember({
    workspace: req.workspace,
    inviter: req.user,
    email: req.body.email,
    role: req.body.role,
  });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Invitation sent',
    data: invitation,
  });
});

export const acceptInvitation = asyncHandler(async (req, res) => {
  const data = await workspaceService.acceptWorkspaceInvitation({
    user: req.user,
    token: req.body.token,
  });
  return sendSuccess(res, { message: 'Invitation accepted', data });
});

export const updateMemberRole = asyncHandler(async (req, res) => {
  const member = await workspaceService.updateMemberRole({
    workspaceId: req.workspace._id,
    memberId: req.params.memberId,
    role: req.body.role,
  });
  return sendSuccess(res, { message: 'Member role updated', data: member });
});

export const removeMember = asyncHandler(async (req, res) => {
  const data = await workspaceService.removeWorkspaceMember({
    workspaceId: req.workspace._id,
    memberId: req.params.memberId,
  });
  return sendSuccess(res, { message: 'Member removed', data });
});
