import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

/**
 * Allowed MIME type categories for file upload validation.
 * Used by both multer fileFilter (pre-upload MIME check) and
 * magic byte validator (post-upload content check).
 */
export const FILE_TYPE_PRESETS = {
  /** Images only — used by user, post routers */
  IMAGES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
  ],
  /** Images + video — used by expert router */
  IMAGES_VIDEO: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
  ],
  /** All media — used by inbox router */
  ALL_MEDIA: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  /** Admin images (no HEIC/HEIF needed) */
  ADMIN_IMAGES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ],
} as const;

export type FileTypePreset = keyof typeof FILE_TYPE_PRESETS;

/** Size presets in bytes */
export const FILE_SIZE_PRESETS = {
  SMALL: 5 * 1024 * 1024, // 5MB — user avatars, admin images
  MEDIUM: 10 * 1024 * 1024, // 10MB — posts, expert, NFT
  LARGE: 50 * 1024 * 1024, // 50MB — inbox (video, audio, docs)
} as const;

export type FileSizePreset = keyof typeof FILE_SIZE_PRESETS;

/**
 * Extension-to-MIME fallback map for iOS devices that may send
 * incorrect or missing MIME types (especially for HEIC/HEIF).
 */
const EXTENSION_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * Creates a configured multer instance with the specified preset.
 * Replaces all inline multer configurations across routers.
 */
export function createUpload(
  allowedTypes: FileTypePreset | readonly string[],
  maxFileSize: FileSizePreset | number = 'MEDIUM',
) {
  const allowedMimeTypes: readonly string[] =
    typeof allowedTypes === 'string' ? FILE_TYPE_PRESETS[allowedTypes] : allowedTypes;

  const fileSizeLimit = typeof maxFileSize === 'string' ? FILE_SIZE_PRESETS[maxFileSize] : maxFileSize;

  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: fileSizeLimit },
    fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
      // Check declared MIME type first
      if (file.mimetype && allowedMimeTypes.includes(file.mimetype)) {
        return cb(null, true);
      }

      // Fallback: check file extension (iOS HEIC workaround)
      if (file.originalname) {
        const ext = file.originalname.split('.').pop()?.toLowerCase();
        if (ext && ext in EXTENSION_MIME_MAP) {
          const mappedMime = EXTENSION_MIME_MAP[ext];
          if (allowedMimeTypes.includes(mappedMime)) {
            return cb(null, true);
          }
        }
      }

      cb(
        new Error(
          `Unsupported file type: ${file.mimetype || 'unknown'}. ` +
            `Allowed: ${allowedMimeTypes.join(', ')}`,
        ),
      );
    },
  });
}
