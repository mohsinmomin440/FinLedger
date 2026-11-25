import { Activity, Notification, WorkspaceMember } from '../models/index.js';
import { sessionOptions } from '../config/db.js';

let ioInstance = null;

export function setSocketServer(io) {
  ioInstance = io;
}

export function getSocketServer() {
  return ioInstance;
}

export function emitWorkspaceEvent(workspaceId, event, payload) {
  if (!ioInstance || !workspaceId) return;
  ioInstance.to(`workspace:${String(workspaceId)}`).emit(event, payload);
}

export function emitUserEvent(userId, event, payload) {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${String(userId)}`).emit(event, payload);
}

export async function createActivity(
  { workspaceId, actorId = null, type, title, message, entityType = '', entityId = null, metadata = {} },
  session = null
) {
  const [activity] = await Activity.create(
    [
      {
        workspace: workspaceId,
        actor: actorId,
        type,
        title,
        message,
        entityType,
        entityId,
        metadata,
      },
    ],
    sessionOptions(session)
  );
  return activity;
}

export async function createWorkspaceNotifications(
  { workspaceId, userIds = null, type, title, message, metadata = {} },
  session = null
) {
  let targets = userIds;
  if (!targets) {
    const members = await WorkspaceMember.find({ workspace: workspaceId })
      .select('user')
      .session(session || null);
    targets = members.map((m) => m.user);
  }

  if (!targets || targets.length === 0) return [];

  const docs = targets.map((userId) => ({
    workspace: workspaceId,
    user: userId,
    type,
    title,
    message,
    metadata,
  }));

  return Notification.insertMany(docs, sessionOptions(session));
}

export async function listNotifications({ workspaceId, userId, limit = 30 }) {
  const [items, unreadCount] = await Promise.all([
    Notification.find({ workspace: workspaceId, user: userId })
      .sort({ createdAt: -1 })
      .limit(limit),
    Notification.countDocuments({ workspace: workspaceId, user: userId, readAt: null }),
  ]);

  return { items, unreadCount };
}

export async function markNotificationRead({ workspaceId, userId, notificationId }) {
  const updated = await Notification.findOneAndUpdate(
    { _id: notificationId, workspace: workspaceId, user: userId },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  return updated;
}

export async function markAllNotificationsRead({ workspaceId, userId }) {
  const res = await Notification.updateMany(
    { workspace: workspaceId, user: userId, readAt: null },
    { $set: { readAt: new Date() } }
  );
  return { modifiedCount: res.modifiedCount };
}
