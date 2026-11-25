import mongoose from 'mongoose';
import { Workspace, WorkspaceMember } from '../models/index.js';
import { hasMinRole } from '../constants/roles.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export function requireWorkspace(minRole = 'VIEWER') {
  return asyncHandler(async (req, _res, next) => {
    const requestedId =
      req.headers['x-workspace-id'] ||
      req.params.workspaceId ||
      (req.user?.activeWorkspace ? String(req.user.activeWorkspace) : null);

    if (!requestedId || !mongoose.Types.ObjectId.isValid(requestedId)) {
      throw ApiError.badRequest('Valid workspace identifier is required', 'WORKSPACE_REQUIRED');
    }

    const [workspace, membership] = await Promise.all([
      Workspace.findById(requestedId),
      WorkspaceMember.findOne({ workspace: requestedId, user: req.user._id }),
    ]);

    if (!workspace || !membership) {
      throw ApiError.forbidden('You do not have access to this workspace', 'WORKSPACE_ACCESS_DENIED');
    }

    if (!hasMinRole(membership.role, minRole)) {
      throw ApiError.forbidden(
        `Role ${minRole} or higher is required for this action`,
        'INSUFFICIENT_ROLE'
      );
    }

    req.workspace = workspace;
    req.workspaceMember = membership;
    req.workspaceRole = membership.role;
    next();
  });
}
