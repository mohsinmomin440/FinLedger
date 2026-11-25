import crypto from 'node:crypto';
import { Invitation, User, Workspace, WorkspaceMember } from '../models/index.js';
import { runInTransaction, sessionOptions } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { generateOpaqueToken, sha256 } from '../utils/crypto.js';
import { ensureStarterAccounts } from './ledger.service.js';
import { sendWorkspaceInviteEmail } from './email.service.js';

function slugifyWorkspace(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return `${base || 'workspace'}-${crypto.randomBytes(3).toString('hex')}`;
}

export async function listUserWorkspaces(userId) {
  const memberships = await WorkspaceMember.find({ user: userId }).populate('workspace');
  return memberships
    .filter((m) => m.workspace)
    .map((m) => ({
      ...m.workspace.toObject(),
      role: m.role,
    }));
}

export async function createWorkspace(userId, { name, type = 'BUSINESS', baseCurrency = 'INR' }) {
  return runInTransaction(async (session) => {
    const [workspace] = await Workspace.create(
      [
        {
          name: name.trim(),
          slug: slugifyWorkspace(name),
          type,
          baseCurrency,
          owner: userId,
        },
      ],
      sessionOptions(session)
    );

    await WorkspaceMember.create(
      [
        {
          workspace: workspace._id,
          user: userId,
          role: 'OWNER',
        },
      ],
      sessionOptions(session)
    );

    await ensureStarterAccounts(workspace._id, workspace.baseCurrency, session);
    await User.updateOne(
      { _id: userId },
      { $set: { activeWorkspace: workspace._id } },
      sessionOptions(session)
    );

    return { ...workspace.toObject(), role: 'OWNER' };
  });
}

export async function switchWorkspace(userId, workspaceId) {
  const membership = await WorkspaceMember.findOne({
    workspace: workspaceId,
    user: userId,
  }).populate('workspace');

  if (!membership || !membership.workspace) {
    throw ApiError.forbidden('You are not a member of this workspace', 'WORKSPACE_ACCESS_DENIED');
  }

  await User.updateOne({ _id: userId }, { $set: { activeWorkspace: membership.workspace._id } });

  return {
    workspace: membership.workspace,
    role: membership.role,
  };
}

export async function updateWorkspace(workspaceId, updates) {
  const allowed = {};
  if (updates.name !== undefined) allowed.name = updates.name.trim();
  if (updates.type !== undefined) allowed.type = updates.type;
  if (updates.baseCurrency !== undefined) allowed.baseCurrency = updates.baseCurrency;

  const updated = await Workspace.findByIdAndUpdate(
    workspaceId,
    { $set: allowed },
    { new: true }
  );
  if (!updated) throw ApiError.notFound('Workspace not found');
  return updated;
}

export async function listWorkspaceMembers(workspaceId) {
  const [members, invitations] = await Promise.all([
    WorkspaceMember.find({ workspace: workspaceId }).populate('user', 'name email defaultCurrency'),
    Invitation.find({ workspace: workspaceId, status: 'PENDING' }).sort({ createdAt: -1 }),
  ]);

  return {
    members: members.map((m) => ({
      id: String(m._id),
      role: m.role,
      joinedAt: m.createdAt,
      user: m.user
        ? {
            id: String(m.user._id),
            name: m.user.name,
            email: m.user.email,
            defaultCurrency: m.user.defaultCurrency,
          }
        : null,
    })),
    invitations: invitations.map((inv) => ({
      id: String(inv._id),
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    })),
  };
}

export async function inviteWorkspaceMember({ workspace, inviter, email, role }) {
  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    const existingMember = await WorkspaceMember.findOne({
      workspace: workspace._id,
      user: existingUser._id,
    });
    if (existingMember) {
      throw ApiError.conflict('User is already a member of this workspace', 'ALREADY_MEMBER');
    }
  }

  await Invitation.updateMany(
    { workspace: workspace._id, email: normalizedEmail, status: 'PENDING' },
    { $set: { status: 'REVOKED' } }
  );

  const rawToken = generateOpaqueToken(32);
  const invitation = await Invitation.create({
    workspace: workspace._id,
    email: normalizedEmail,
    role,
    tokenHash: sha256(rawToken),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'PENDING',
    invitedBy: inviter._id,
  });

  await sendWorkspaceInviteEmail({
    to: normalizedEmail,
    workspaceName: workspace.name,
    inviterName: inviter.name,
    role,
    token: rawToken,
  });

  return {
    id: String(invitation._id),
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
  };
}

export async function acceptWorkspaceInvitation({ user, token }) {
  const invitation = await Invitation.findOne({
    tokenHash: sha256(token),
    status: 'PENDING',
    expiresAt: { $gt: new Date() },
  });

  if (!invitation) {
    throw ApiError.badRequest('Invalid or expired invitation token', 'INVALID_INVITATION');
  }

  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    throw ApiError.forbidden(
      'This invitation was issued for a different email address',
      'INVITATION_EMAIL_MISMATCH'
    );
  }

  return runInTransaction(async (session) => {
    const member = await WorkspaceMember.findOneAndUpdate(
      { workspace: invitation.workspace, user: user._id },
      { $setOnInsert: { workspace: invitation.workspace, user: user._id, role: invitation.role } },
      { upsert: true, new: true, ...sessionOptions(session) }
    );

    invitation.status = 'ACCEPTED';
    await invitation.save(sessionOptions(session));

    await User.updateOne(
      { _id: user._id },
      { $set: { activeWorkspace: invitation.workspace } },
      sessionOptions(session)
    );

    const workspace = await Workspace.findById(invitation.workspace).session(session || null);
    return { workspace, member };
  });
}

export async function updateMemberRole({ workspaceId, memberId, role }) {
  const member = await WorkspaceMember.findOne({ _id: memberId, workspace: workspaceId });
  if (!member) {
    throw ApiError.notFound('Workspace member not found', 'MEMBER_NOT_FOUND');
  }
  if (member.role === 'OWNER' && role !== 'OWNER') {
    const ownerCount = await WorkspaceMember.countDocuments({
      workspace: workspaceId,
      role: 'OWNER',
    });
    if (ownerCount <= 1) {
      throw ApiError.badRequest('Workspace must have at least one OWNER', 'SOLE_OWNER_REQUIRED');
    }
  }
  member.role = role;
  await member.save();
  return member;
}

export async function removeWorkspaceMember({ workspaceId, memberId }) {
  const member = await WorkspaceMember.findOne({ _id: memberId, workspace: workspaceId });
  if (!member) {
    throw ApiError.notFound('Workspace member not found', 'MEMBER_NOT_FOUND');
  }
  if (member.role === 'OWNER') {
    const ownerCount = await WorkspaceMember.countDocuments({
      workspace: workspaceId,
      role: 'OWNER',
    });
    if (ownerCount <= 1) {
      throw ApiError.badRequest('Cannot remove the sole workspace owner', 'SOLE_OWNER_REQUIRED');
    }
  }
  await member.deleteOne();
  return { removed: true };
}
