import { z } from 'zod';

/* ========== News ========== */

export const AdminNewsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
  brandId: z.string().uuid().optional(),
  tags: z.string().optional(), // Comma-separated tags
  source: z.string().optional(),
  sort: z.enum(['createdAt', 'viewsCount', 'likesCount']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminCreateNewsSchema = z.object({
  brandId: z.string().uuid(),
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  bannerImageUrl: z.string().url().optional().nullable(),
  source: z.string().default('tipbox'),
  author: z.string().max(200).optional().nullable(),
  tags: z.array(z.string()).default([]),
});

export const AdminUpdateNewsSchema = AdminCreateNewsSchema.partial().omit({
  brandId: true,
});

/* ========== News Comments ========== */

export const AdminNewsCommentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  newsId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'likesCount']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Note: NewsComment moderation is done via delete only (no isHidden field in schema)
