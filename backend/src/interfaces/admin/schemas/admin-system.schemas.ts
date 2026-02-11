import { z } from 'zod';

/* ========== Action Types ========== */

export const AdminActionTypesQuerySchema = z.object({
  mainAction: z
    .enum([
      'CONTENT_CREATE',
      'CONTENT_INTERACT',
      'SOCIAL',
      'TRANSACTION',
      'ACHIEVEMENT',
      'EVENT',
      'PROFILE',
      'OTHER',
    ])
    .optional(),
  search: z.string().optional(),
});

export const AdminCreateActionTypeSchema = z.object({
  mainAction: z.enum([
    'CONTENT_CREATE',
    'CONTENT_INTERACT',
    'SOCIAL',
    'TRANSACTION',
    'ACHIEVEMENT',
    'EVENT',
    'PROFILE',
    'OTHER',
  ]),
  code: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
});

export const AdminUpdateActionTypeSchema = AdminCreateActionTypeSchema.partial().omit({
  mainAction: true,
  code: true,
});

/* ========== System Configuration ========== */

export const AdminUpdateSystemConfigSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(1000),
  description: z.string().max(500).optional(),
});
