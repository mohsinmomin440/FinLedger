import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { Receipt } from '../models/index.js';
import { persistReceiptFile, resolveReceiptPath } from '../middleware/upload.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';

export const uploadReceipt = asyncHandler(async (req, res) => {
  const saved = await persistReceiptFile(req.workspace._id, req.file);
  const receipt = await Receipt.create({
    workspace: req.workspace._id,
    uploadedBy: req.user._id,
    entityType: req.body.entityType || 'GENERAL',
    entityId: req.body.entityId || null,
    originalName: saved.originalName,
    mimeType: saved.mimeType,
    sizeBytes: saved.sizeBytes,
    storageKey: saved.storageKey,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Receipt uploaded',
    data: receipt,
  });
});

export const listReceipts = asyncHandler(async (req, res) => {
  const receipts = await Receipt.find({ workspace: req.workspace._id }).sort({ createdAt: -1 });
  return sendSuccess(res, { data: receipts });
});

export const streamReceiptFile = asyncHandler(async (req, res) => {
  const receipt = await Receipt.findOne({ _id: req.params.id, workspace: req.workspace._id });
  if (!receipt) {
    throw ApiError.notFound('Receipt not found', 'RECEIPT_NOT_FOUND');
  }

  const filePath = resolveReceiptPath(receipt.storageKey);
  if (!fsSync.existsSync(filePath)) {
    throw ApiError.notFound('Receipt file missing on storage', 'FILE_NOT_FOUND');
  }

  const disposition = req.query.download === '1' ? 'attachment' : 'inline';
  res.setHeader('Content-Type', receipt.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${receipt.originalName.replace(/"/g, '')}"`
  );

  return fsSync.createReadStream(filePath).pipe(res);
});

export const deleteReceipt = asyncHandler(async (req, res) => {
  const receipt = await Receipt.findOneAndDelete({
    _id: req.params.id,
    workspace: req.workspace._id,
  });
  if (!receipt) {
    throw ApiError.notFound('Receipt not found', 'RECEIPT_NOT_FOUND');
  }

  const filePath = resolveReceiptPath(receipt.storageKey);
  await fs.unlink(filePath).catch(() => {});

  return sendSuccess(res, { message: 'Receipt deleted', data: { deleted: true } });
});
