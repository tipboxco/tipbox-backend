import { z } from 'zod';

/* ========== Brands ========== */

export const AdminBrandsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  isPopular: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  sort: z.enum(['createdAt', 'name', 'rank']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminCreateBrandSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  externalId: z.string().optional().nullable(),
  rank: z.number().int().min(0).default(0),
  isPopular: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

export const AdminUpdateBrandSchema = AdminCreateBrandSchema.partial();

/* ========== Brand Categories ========== */

export const AdminBrandCategoriesQuerySchema = z.object({
  search: z.string().optional(),
});

export const AdminCreateBrandCategorySchema = z.object({
  name: z.string().min(1).max(200),
  imageUrl: z.string().url().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
});

export const AdminUpdateBrandCategorySchema = AdminCreateBrandCategorySchema.partial();

/* ========== Brand Surveys ========== */

export const AdminBrandSurveysQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  brandId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'UPCOMING', 'ENDED']).optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'startsAt', 'endsAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminCreateBrandSurveySchema = z.object({
  brandId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  questions: z.array(
    z.object({
      questionText: z.string().min(1).max(1000),
      type: z.enum(['TEXT', 'MULTIPLE_CHOICE', 'RATING']),
    })
  ),
});

export const AdminUpdateBrandSurveySchema = AdminCreateBrandSurveySchema.partial().omit({
  brandId: true,
  questions: true,
});
