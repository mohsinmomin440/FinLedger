import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as recurringService from '../services/recurring.service.js';

export const listRecurringRules = asyncHandler(async (req, res) => {
  const rules = await recurringService.listRecurringRules({ workspaceId: req.workspace._id });
  return sendSuccess(res, { data: rules });
});

export const createRecurringRule = asyncHandler(async (req, res) => {
  const rule = await recurringService.createRecurringRule({
    workspaceId: req.workspace._id,
    actorId: req.user._id,
    payload: req.body,
  });
  return sendSuccess(res, { statusCode: 201, message: 'Recurring rule created', data: rule });
});

export const updateRecurringRule = asyncHandler(async (req, res) => {
  const rule = await recurringService.updateRecurringRule({
    workspaceId: req.workspace._id,
    ruleId: req.params.id,
    payload: req.body,
  });
  return sendSuccess(res, { message: 'Recurring rule updated', data: rule });
});

export const deleteRecurringRule = asyncHandler(async (req, res) => {
  const data = await recurringService.deleteRecurringRule({
    workspaceId: req.workspace._id,
    ruleId: req.params.id,
  });
  return sendSuccess(res, { message: 'Recurring rule deleted', data });
});

export const triggerRecurringRule = asyncHandler(async (req, res) => {
  const data = await recurringService.triggerRecurringRuleNow({
    workspace: req.workspace,
    ruleId: req.params.id,
  });
  return sendSuccess(res, { message: 'Recurring rule executed', data });
});
