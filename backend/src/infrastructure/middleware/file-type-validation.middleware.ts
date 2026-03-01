import { Request, Response, NextFunction } from 'express';
import { fromBuffer } from 'file-type';
import { ErrorCode } from '../errors/error-codes.enum';
import { FILE_TYPE_PRESETS, FileTypePreset } from '../config/file-upload.config';
import logger from '../logger/logger';

/**
 * Maps file-type package detection results to our allowed MIME type lists.
 * Some file types detected by file-type use slightly different MIME strings.
 */
const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'audio/mp3': 'audio/mpeg',
  'video/x-m4v': 'video/mp4',
};

/**
 * MIME types that file-type cannot detect from magic bytes.
 * For these, we fall back to extension + declared MIME validation.
 */
const MAGIC_BYTE_UNDETECTABLE = new Set([
  'application/msword', // .doc — old binary format, file-type detects as 'application/x-cfb'
]);

/**
 * file-type may detect HEIC/HEIF as different specific variants.
 */
const HEIC_VARIANTS = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

/**
 * Validates file content against magic bytes AFTER multer has processed the upload.
 *
 * This middleware MUST be placed AFTER multer middleware in the chain:
 *   `upload.single('file'), validateFileType('IMAGES'), asyncHandler(...)`
 *
 * Handles req.file (single), req.files (array/fields).
 * If no files are present, passes through (file presence is the handler's job).
 */
export function validateFileType(allowedTypes: FileTypePreset | readonly string[] = 'IMAGES') {
  const allowedMimeTypes: string[] =
    typeof allowedTypes === 'string' ? [...FILE_TYPE_PRESETS[allowedTypes]] : [...allowedTypes];

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const files = collectFiles(req);

      if (files.length === 0) {
        return next();
      }

      for (const file of files) {
        const error = await validateSingleFile(file, allowedMimeTypes);
        if (error) {
          logger.warn('File type validation failed (magic bytes)', {
            path: req.path,
            method: req.method,
            filename: file.originalname,
            declaredMime: file.mimetype,
            error,
          });

          res.status(400).json({
            success: false,
            error: {
              code: ErrorCode.INVALID_FILE_TYPE,
              message: error,
              timestamp: new Date().toISOString(),
              path: req.path,
            },
          });
          return;
        }
      }

      next();
    } catch (error) {
      logger.error('File type validation error', {
        path: req.path,
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  };
}

/**
 * Collects all uploaded files from the request into a flat array.
 */
function collectFiles(req: Request): Express.Multer.File[] {
  const files: Express.Multer.File[] = [];

  if (req.file) {
    files.push(req.file);
  }

  if (req.files) {
    if (Array.isArray(req.files)) {
      files.push(...req.files);
    } else {
      for (const fieldFiles of Object.values(req.files)) {
        files.push(...fieldFiles);
      }
    }
  }

  return files;
}

/**
 * Validates a single file's buffer against magic bytes.
 * Returns null if valid, or an error message string if invalid.
 */
async function validateSingleFile(
  file: Express.Multer.File,
  allowedMimeTypes: string[],
): Promise<string | null> {
  if (!file.buffer || file.buffer.length === 0) {
    return `File "${file.originalname}" has no content.`;
  }

  const detectedType = await fromBuffer(file.buffer);

  // file-type could not detect the type
  if (!detectedType) {
    // For types known to be undetectable by magic bytes, allow through
    if (isUndetectableType(file, allowedMimeTypes)) {
      return null;
    }

    return (
      `File "${file.originalname}" could not be verified. ` +
      `The file content does not match any known file format.`
    );
  }

  // Normalize the detected MIME type
  let detectedMime: string = detectedType.mime;
  if (MIME_ALIASES[detectedMime]) {
    detectedMime = MIME_ALIASES[detectedMime];
  }

  // Check HEIC variants
  if (HEIC_VARIANTS.has(detectedMime)) {
    const heicAllowed = allowedMimeTypes.some((m) => m === 'image/heic' || m === 'image/heif');
    if (heicAllowed) {
      return null;
    }
  }

  // Check against allowed types
  if (allowedMimeTypes.includes(detectedMime)) {
    return null;
  }

  return (
    `File "${file.originalname}" content does not match its declared type. ` +
    `Declared: ${file.mimetype}, Detected: ${detectedMime}. ` +
    `This file type is not allowed.`
  );
}

/**
 * Checks if a file's declared type is known to be undetectable by magic bytes,
 * AND its declared MIME is in the allowed list (multer already validated it).
 */
function isUndetectableType(file: Express.Multer.File, allowedMimeTypes: string[]): boolean {
  return MAGIC_BYTE_UNDETECTABLE.has(file.mimetype) && allowedMimeTypes.includes(file.mimetype);
}
