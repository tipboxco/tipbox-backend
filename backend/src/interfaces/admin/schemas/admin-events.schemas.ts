import { z } from 'zod';
import { AdminPaginationQuerySchema } from './admin-common.schemas';

/* ========== Admin Events ========== */

const EventStatusEnum = z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']);
const EventFeedTypeEnum = z.enum(['PICKS', 'ROASTS']);

export const AdminCreateEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  status: EventStatusEnum.optional().default('DRAFT'),
  feedType: EventFeedTypeEnum.optional().default('PICKS'),
  productId: z.string().optional().nullable(),
  brandId: z.string().uuid().optional().nullable(),
  mainCategoryId: z.string().uuid().optional().nullable(),
  subCategoryId: z.string().uuid().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

export const AdminUpdateEventSchema = AdminCreateEventSchema.partial();

export const AdminEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: EventStatusEnum.optional(),
  feedType: EventFeedTypeEnum.optional(),
  search: z.string().min(1).optional(),
  sort: z.enum(['createdAt', 'startDate', 'endDate', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminEventParticipantsQuerySchema = AdminPaginationQuerySchema.extend({
  sort: z.enum(['eventPostsCount', 'eventLikesReceived', 'totalParticipated', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminAddEventBadgeSchema = z.object({
  badgeId: z.string().uuid(),
  rank: z.number().int().min(0),
  displayOrder: z.number().int().optional().nullable(),
});

export const AdminUpdateEventBadgeSchema = z.object({
  rank: z.number().int().min(0).optional(),
  displayOrder: z.number().int().optional().nullable(),
  enabled: z.boolean().optional(),
});

export const AdminEventRewardsQuerySchema = AdminPaginationQuerySchema.extend({
  userId: z.string().uuid().optional(),
  rewardType: z.enum(['TIPS', 'BADGE', 'TITLE']).optional(),
  sort: z.enum(['awardedAt', 'createdAt']).default('awardedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/* ========== Type Exports ========== */

export type AdminCreateEventInput = z.infer<typeof AdminCreateEventSchema>;
export type AdminUpdateEventInput = z.infer<typeof AdminUpdateEventSchema>;
export type AdminEventsQuery = z.infer<typeof AdminEventsQuerySchema>;
export type AdminAddEventBadgeInput = z.infer<typeof AdminAddEventBadgeSchema>;
export type AdminUpdateEventBadgeInput = z.infer<typeof AdminUpdateEventBadgeSchema>;
