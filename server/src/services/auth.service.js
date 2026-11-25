import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { RefreshToken, User, Workspace, WorkspaceMember } from '../models/index.js';
import { runInTransaction, sessionOptions } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import {
  generateOpaqueToken,
  sha256,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/crypto.js';
import { ensureStarterAccounts } from './ledger.service.js';
import { sendPasswordResetEmail, sendVerificationEmail } from './email.service.js';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function slugifyWorkspace(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base || 'workspace'}-${suffix}`;
}

function sanitizeUser(user) {
  return {
    id: String(user._id),
    _id: String(user._id),
    name: user.name,
    email: user.email,
    defaultCurrency: user.defaultCurrency,
    emailVerified: user.emailVerified,
    activeWorkspace: user.activeWorkspace ? String(user.activeWorkspace) : null,
    createdAt: user.createdAt,
  };
}

async function issueSessionTokens({ user, familyId = null, userAgent = 'unknown', ipAddress = 'unknown' }, session = null) {
  const resolvedFamilyId = familyId || crypto.randomUUID();
  const jti = crypto.randomUUID();
  const rawRefreshToken = signRefreshToken({
    userId: user._id,
    familyId: resolvedFamilyId,
    jti,
  });
  const tokenHash = sha256(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await RefreshToken.create(
    [
      {
        user: user._id,
        tokenHash,
        familyId: resolvedFamilyId,
        expiresAt,
        userAgent,
        ipAddress,
      },
    ],
    sessionOptions(session)
  );

  const accessToken = signAccessToken(user);
  const csrfToken = generateOpaqueToken(24);

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    csrfToken,
  };
}

export async function registerUser(
  { name, email, password, defaultCurrency = 'INR', workspaceName, workspaceType = 'PERSONAL' },
  meta = {}
) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists', 'EMAIL_EXISTS');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const verificationToken = generateOpaqueToken(32);

  const result = await runInTransaction(async (session) => {
    const [user] = await User.create(
      [
        {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          defaultCurrency,
          emailVerified: false,
          emailVerificationTokenHash: sha256(verificationToken),
          emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      ],
      sessionOptions(session)
    );

    const wsName = workspaceName?.trim() || `${name.trim()}'s Ledger`;
    const [workspace] = await Workspace.create(
      [
        {
          name: wsName,
          slug: slugifyWorkspace(wsName),
          type: workspaceType,
          baseCurrency: defaultCurrency,
          owner: user._id,
        },
      ],
      sessionOptions(session)
    );

    await WorkspaceMember.create(
      [
        {
          workspace: workspace._id,
          user: user._id,
          role: 'OWNER',
        },
      ],
      sessionOptions(session)
    );

    user.activeWorkspace = workspace._id;
    await user.save(sessionOptions(session));

    await ensureStarterAccounts(workspace._id, workspace.baseCurrency, session);
    const tokens = await issueSessionTokens({ user, ...meta }, session);

    return { user, workspace, ...tokens };
  });

  await sendVerificationEmail({
    to: result.user.email,
    name: result.user.name,
    token: verificationToken,
  });

  return {
    user: sanitizeUser(result.user),
    workspace: result.workspace,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    csrfToken: result.csrfToken,
  };
}

export async function loginUser({ email, password }, meta = {}) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const memberships = await WorkspaceMember.find({ user: user._id }).populate('workspace');
  let activeWorkspace = memberships.find(
    (m) => user.activeWorkspace && String(m.workspace?._id) === String(user.activeWorkspace)
  )?.workspace;

  if (!activeWorkspace && memberships[0]?.workspace) {
    activeWorkspace = memberships[0].workspace;
    user.activeWorkspace = activeWorkspace._id;
    await user.save();
  }

  const tokens = await issueSessionTokens({ user, ...meta });

  return {
    user: sanitizeUser(user),
    workspace: activeWorkspace || null,
    workspaces: memberships.map((m) => ({
      ...m.workspace.toObject(),
      role: m.role,
    })),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    csrfToken: tokens.csrfToken,
  };
}

export async function refreshSession(rawRefreshToken, meta = {}) {
  if (!rawRefreshToken) {
    throw ApiError.unauthorized('Missing refresh token', 'MISSING_REFRESH_TOKEN');
  }

  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const tokenHash = sha256(rawRefreshToken);
  const tokenDoc = await RefreshToken.findOne({ tokenHash });

  if (!tokenDoc) {
    throw ApiError.unauthorized('Refresh session not found', 'INVALID_REFRESH_TOKEN');
  }

  // Reuse detection: revoked token presented again -> revoke entire family immediately
  if (tokenDoc.revokedAt) {
    await RefreshToken.updateMany(
      { familyId: tokenDoc.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    throw ApiError.unauthorized(
      'Refresh token reuse detected; entire session family revoked',
      'REFRESH_TOKEN_REUSE'
    );
  }

  if (tokenDoc.expiresAt <= new Date()) {
    throw ApiError.unauthorized('Refresh token expired', 'REFRESH_TOKEN_EXPIRED');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('User not found', 'USER_NOT_FOUND');
  }

  const rotated = await runInTransaction(async (session) => {
    const newTokens = await issueSessionTokens(
      { user, familyId: tokenDoc.familyId, ...meta },
      session
    );

    const updated = await RefreshToken.findOneAndUpdate(
      { _id: tokenDoc._id, revokedAt: null },
      {
        $set: {
          revokedAt: new Date(),
          replacedByTokenHash: sha256(newTokens.refreshToken),
        },
      },
      { ...sessionOptions(session), new: true }
    );

    if (!updated) {
      await RefreshToken.updateMany(
        { familyId: tokenDoc.familyId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
        sessionOptions(session)
      );
      throw ApiError.unauthorized('Concurrent refresh token reuse detected', 'REFRESH_TOKEN_REUSE');
    }

    return newTokens;
  });

  const memberships = await WorkspaceMember.find({ user: user._id }).populate('workspace');
  const activeWorkspace =
    memberships.find((m) => String(m.workspace?._id) === String(user.activeWorkspace))?.workspace ||
    memberships[0]?.workspace ||
    null;

  return {
    user: sanitizeUser(user),
    workspace: activeWorkspace,
    workspaces: memberships.map((m) => ({
      ...m.workspace.toObject(),
      role: m.role,
    })),
    accessToken: rotated.accessToken,
    refreshToken: rotated.refreshToken,
    csrfToken: rotated.csrfToken,
  };
}

export async function logoutSession(rawRefreshToken) {
  if (!rawRefreshToken) return;
  const tokenHash = sha256(rawRefreshToken);
  await RefreshToken.updateOne(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

export async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const memberships = await WorkspaceMember.find({ user: user._id }).populate('workspace');
  const activeMembership =
    memberships.find((m) => String(m.workspace?._id) === String(user.activeWorkspace)) ||
    memberships[0] ||
    null;

  return {
    user: sanitizeUser(user),
    workspace: activeMembership?.workspace || null,
    role: activeMembership?.role || null,
    workspaces: memberships
      .filter((m) => m.workspace)
      .map((m) => ({
        ...m.workspace.toObject(),
        role: m.role,
      })),
  };
}

export async function listActiveSessions(userId, currentRefreshToken = null) {
  const currentHash = currentRefreshToken ? sha256(currentRefreshToken) : null;
  const sessions = await RefreshToken.find({
    user: userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .select('_id familyId userAgent ipAddress expiresAt createdAt tokenHash');

  return sessions.map((s) => ({
    id: String(s._id),
    familyId: s.familyId,
    userAgent: s.userAgent,
    ipAddress: s.ipAddress,
    expiresAt: s.expiresAt,
    createdAt: s.createdAt,
    isCurrent: currentHash ? s.tokenHash === currentHash : false,
  }));
}

export async function revokeUserSession(userId, sessionId) {
  const sessionDoc = await RefreshToken.findOneAndUpdate(
    { _id: sessionId, user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: true }
  );
  if (!sessionDoc) {
    throw ApiError.notFound('Session not found', 'SESSION_NOT_FOUND');
  }
  return { id: String(sessionDoc._id), revokedAt: sessionDoc.revokedAt };
}

export async function requestPasswordReset(email) {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    return { dispatched: true };
  }

  const rawToken = generateOpaqueToken(32);
  user.passwordResetTokenHash = sha256(rawToken);
  user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  await sendPasswordResetEmail({ to: user.email, name: user.name, token: rawToken });
  return { dispatched: true };
}

export async function resetPassword({ token, password }) {
  const user = await User.findOne({
    passwordResetTokenHash: sha256(token),
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordHash +passwordResetTokenHash +passwordResetExpiresAt');

  if (!user) {
    throw ApiError.badRequest('Invalid or expired password reset token', 'INVALID_RESET_TOKEN');
  }

  user.passwordHash = await bcrypt.hash(password, 10);
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  await user.save();

  await RefreshToken.updateMany(
    { user: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  return { reset: true };
}

export async function verifyEmailToken(token) {
  const user = await User.findOne({
    emailVerificationTokenHash: sha256(token),
    emailVerificationExpiresAt: { $gt: new Date() },
  }).select('+emailVerificationTokenHash +emailVerificationExpiresAt');

  if (!user) {
    throw ApiError.badRequest('Invalid or expired verification token', 'INVALID_VERIFY_TOKEN');
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpiresAt = null;
  await user.save();

  return sanitizeUser(user);
}
