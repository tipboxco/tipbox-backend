import { z } from 'zod';

/* ========== Products ========== */

export const AdminProductsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  groupId: z.string().uuid().optional(),
  brandId: z.string().optional(),
  sort: z.enum(['createdAt', 'name']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminCreateProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  subName: z.string().max(200).optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  thumbnail: z.string().url().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const AdminUpdateProductSchema = AdminCreateProductSchema.partial().omit({ id: true });

export const AdminMergeProductsSchema = z.object({
  sourceProductId: z.string(),
  targetProductId: z.string(),
});

/* ========== Categories ========== */

export const AdminCategoriesQuerySchema = z.object({
  parentId: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  search: z.string().optional(),
});

export const AdminCreateCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  parentId: z.string().optional().nullable(),
  thumbnail: z.string().url().optional().nullable(),
  handle: z.string().optional().nullable(),
  rank: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const AdminUpdateCategorySchema = AdminCreateCategorySchema.partial().omit({ id: true });

export const AdminReorderCategorySchema = z.object({
  rank: z.number().int().min(0),
});

/* ========== Product Groups ========== */

export const AdminProductGroupsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
  subCategoryId: z.string().optional(),
});

export const AdminCreateProductGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  subCategoryId: z.string().uuid(),
  imageUrl: z.string().url().optional().nullable(),
});

export const AdminUpdateProductGroupSchema = AdminCreateProductGroupSchema.partial().omit({
  id: true,
});

/* ========== Product Suggestions ========== */

export const AdminProductSuggestionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  userId: z.string().uuid().optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'reviewedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminApproveSuggestionSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1).max(500),
  groupId: z.string().uuid().optional().nullable(),
  brandId: z.string().optional().nullable(),
});

export const AdminRejectSuggestionSchema = z.object({
  reason: z.string().min(1).max(500),
});

/* ========== User Inventories ========== */

export const AdminInventoriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  userId: z.string().uuid().optional(),
  productId: z.string().optional(),
  search: z.string().optional(), // username or product name
  sort: z.enum(['createdAt', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
