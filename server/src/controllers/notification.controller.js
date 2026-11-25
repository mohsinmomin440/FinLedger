import { Activity } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as notificationService from '../services/notification.service.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const data = await notificationService.listNotifications({
    workspaceId: req.workspace._id,
    userId: req.user._id,
  });
  const activities = await Activity.find({ workspace: req.workspace._id })
    .sort({ createdAt: -1 })
    .limit(25)
    .populate('actor', 'name email');

  return sendSuccess(res, { data: { ...data, activities } });
});

export const markRead = asyncHandler(async (req, res) => {
  const updated = await notificationService.markNotificationRead({
    workspaceId: req.workspace._id,
    userId: req.user._id,
    notificationId: req.params.id,
  });
  if (!updated) throw ApiError.notFound('Notification not found', 'NOTIFICATION_NOT_FOUND');
  return sendSuccess(res, { message: 'Notification marked read', data: updated });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAllNotificationsRead({
    workspaceId: req.workspace._id,
    userId: req.user._id,
  });
  return sendSuccess(res, { message: 'All notifications marked read', data });
});
