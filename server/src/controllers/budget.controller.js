import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as budgetService from '../services/budget.service.js';

export const listBudgets = asyncHandler(async (req, res) => {
  const items = await budgetService.listBudgetsWithSpend({
    workspaceId: req.workspace._id,
    monthKey: req.query.monthKey,
  });
  return sendSuccess(res, { data: items });
});

export const upsertBudget = asyncHandler(async (req, res) => {
  const budget = await budgetService.upsertBudget({
    workspaceId: req.workspace._id,
    ...req.body,
  });
  return sendSuccess(res, { statusCode: 201, message: 'Budget saved', data: budget });
});

export const deleteBudget = asyncHandler(async (req, res) => {
  const data = await budgetService.deleteBudget({
    workspaceId: req.workspace._id,
    budgetId: req.params.id,
  });
  return sendSuccess(res, { message: 'Budget deleted', data });
});
