import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as transactionService from '../services/transaction.service.js';
import { exportTransactionsCsv } from '../services/analytics.service.js';

export const listTransactions = asyncHandler(async (req, res) => {
  const { items, meta } = await transactionService.listTransactions({
    workspaceId: req.workspace._id,
    query: req.query,
  });
  return sendSuccess(res, { data: items, meta });
});

export const createTransaction = asyncHandler(async (req, res) => {
  const tx = await transactionService.createTransaction({
    workspace: req.workspace,
    actorId: req.user._id,
    payload: req.body,
  });
  return sendSuccess(res, { statusCode: 201, message: 'Transaction posted', data: tx });
});

export const updateTransaction = asyncHandler(async (req, res) => {
  const tx = await transactionService.updateTransaction({
    workspace: req.workspace,
    actorId: req.user._id,
    transactionId: req.params.id,
    payload: req.body,
  });
  return sendSuccess(res, { message: 'Transaction updated with reversing entry', data: tx });
});

export const deleteTransaction = asyncHandler(async (req, res) => {
  const result = await transactionService.voidTransaction({
    workspace: req.workspace,
    actorId: req.user._id,
    transactionId: req.params.id,
  });
  return sendSuccess(res, { message: 'Transaction voided and reversed', data: result });
});

export const exportCsv = asyncHandler(async (req, res) => {
  const csv = await exportTransactionsCsv({
    workspace: req.workspace,
    from: req.query.from,
    to: req.query.to,
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="finledger-transactions.csv"');
  return res.status(200).send(csv);
});
