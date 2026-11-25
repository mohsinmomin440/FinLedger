import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const RECEIPTS_ROOT_DIR = env.RECEIPTS_DIR
  ? path.resolve(env.RECEIPTS_DIR)
  : path.resolve(__dirname, '../../uploads');
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export const ALLOWED_RECEIPT_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
};

export function hasAllowedMagicBytes(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;

  if (mimeType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (mimeType === 'application/pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  return false;
}

export const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_RECEIPT_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExts = ALLOWED_RECEIPT_TYPES[file.mimetype];
    if (!allowedExts || !allowedExts.includes(ext)) {
      return cb(
        ApiError.badRequest(
          'Unsupported receipt file type. Allowed: png, jpg, jpeg, webp, pdf',
          'INVALID_FILE_TYPE'
        )
      );
    }
    return cb(null, true);
  },
});

export async function persistReceiptFile(workspaceId, file) {
  if (!file || !file.buffer) {
    throw ApiError.badRequest('Receipt file is required', 'FILE_REQUIRED');
  }
  if (!hasAllowedMagicBytes(file.buffer, file.mimetype)) {
    throw ApiError.badRequest(
      'File signature does not match declared MIME type',
      'INVALID_FILE_SIGNATURE'
    );
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  const safeName = `${crypto.randomUUID()}${ext}`;
  const workspaceDir = path.join(RECEIPTS_ROOT_DIR, String(workspaceId));
  await fs.mkdir(workspaceDir, { recursive: true });

  const storageKey = `${String(workspaceId)}/${safeName}`;
  const fullPath = path.join(RECEIPTS_ROOT_DIR, storageKey);
  await fs.writeFile(fullPath, file.buffer);

  return {
    storageKey,
    fullPath,
    sizeBytes: file.size || file.buffer.length,
    mimeType: file.mimetype,
    originalName: path.basename(file.originalname),
  };
}

export function resolveReceiptPath(storageKey) {
  const normalized = path.normalize(storageKey);
  const fullPath = path.resolve(RECEIPTS_ROOT_DIR, normalized);
  if (!fullPath.startsWith(RECEIPTS_ROOT_DIR)) {
    throw ApiError.forbidden('Invalid storage path', 'INVALID_STORAGE_PATH');
  }
  return fullPath;
}
