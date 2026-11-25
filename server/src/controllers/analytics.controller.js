import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as analyticsService from '../services/analytics.service.js';
import { getMonthKey } from '../services/budget.service.js';

export const getOverview = asyncHandler(async (req, res) => {
  const monthKey = req.query.monthKey || getMonthKey();
  const months = Number(req.query.months || 6);
  const data = await analyticsService.getAnalyticsOverview({
    workspace: req.workspace,
    user: req.user,
    monthKey,
    months,
  });
  return sendSuccess(res, { data });
});

export const exportCsv = asyncHandler(async (req, res) => {
  const csv = await analyticsService.exportTransactionsCsv({
    workspace: req.workspace,
    from: req.query.from,
    to: req.query.to,
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="finledger-analytics.csv"');
  return res.status(200).send(csv);
});

export const downloadMonthlyStatementPdf = asyncHandler(async (req, res) => {
  const monthKey = req.query.monthKey || getMonthKey();
  const pdfBuffer = await analyticsService.generateMonthlyStatementPdf({
    workspace: req.workspace,
    monthKey,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="finledger-statement-${monthKey}.pdf"`
  );
  res.setHeader('Content-Length', pdfBuffer.length);
  return res.status(200).send(pdfBuffer);
});
