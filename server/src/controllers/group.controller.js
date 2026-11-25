import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as groupService from '../services/group.service.js';

export const listGroups = asyncHandler(async (req, res) => {
  const groups = await groupService.listGroups({ workspaceId: req.workspace._id });
  return sendSuccess(res, { data: groups });
});

export const createGroup = asyncHandler(async (req, res) => {
  const group = await groupService.createGroup({
    workspace: req.workspace,
    actor: req.user,
    payload: req.body,
  });
  return sendSuccess(res, { statusCode: 201, message: 'Expense group created', data: group });
});

export const getGroupBalances = asyncHandler(async (req, res) => {
  const data = await groupService.getGroupDetailsAndBalances({
    workspaceId: req.workspace._id,
    groupId: req.params.id,
  });
  return sendSuccess(res, { data });
});

export const addMember = asyncHandler(async (req, res) => {
  const group = await groupService.addGroupMember({
    workspaceId: req.workspace._id,
    groupId: req.params.id,
    member: req.body,
  });
  return sendSuccess(res, { statusCode: 201, message: 'Group member added', data: group });
});

export const addExpense = asyncHandler(async (req, res) => {
  const expense = await groupService.addGroupExpense({
    workspace: req.workspace,
    actor: req.user,
    groupId: req.params.id,
    payload: req.body,
  });
  return sendSuccess(res, { statusCode: 201, message: 'Group expense added', data: expense });
});

export const updateExpense = asyncHandler(async (req, res) => {
  const expense = await groupService.updateGroupExpense({
    workspace: req.workspace,
    actor: req.user,
    groupId: req.params.id,
    expenseId: req.params.expenseId,
    payload: req.body,
  });
  return sendSuccess(res, { message: 'Group expense updated', data: expense });
});

export const deleteExpense = asyncHandler(async (req, res) => {
  const data = await groupService.deleteGroupExpense({
    workspaceId: req.workspace._id,
    groupId: req.params.id,
    expenseId: req.params.expenseId,
  });
  return sendSuccess(res, { message: 'Group expense deleted', data });
});

export const settleUp = asyncHandler(async (req, res) => {
  const data = await groupService.recordGroupSettlement({
    workspace: req.workspace,
    actor: req.user,
    groupId: req.params.id,
    payload: req.body,
  });
  return sendSuccess(res, { statusCode: 201, message: 'Settlement recorded', data });
});
