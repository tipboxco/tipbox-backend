import { z } from 'zod';
import { AdminPaginationQuerySchema } from './admin-common.schemas';

/* ========== Admin Content ========== */

const ContentPostTypeEnum = z.enum(['FREE', 'TIPS', 'COMPARE', 'QUESTION', 'EXPERIENCE', 'UPDATE']);

export const AdminContentPostsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  type: ContentPostTypeEnum.optional(),
  userId: z.string().uuid().optional(),
  eventId: z.string().optional(),
  mainCategoryId: z.string().uuid().optional(),
  subCategoryId: z.string().uuid().optional(),
  productId: z.string().optional(),
  search: z.string().min(1).optional(),
  sort: z.enum(['createdAt', 'likesCount', 'commentsCount', 'viewsCount', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminContentPostUpdateSchema = z.object({
  title: z.string().min(1).max(1000).optional(),
  body: z.string().max(100000).optional(),
  isBoosted: z.boolean().optional(),
  boostedUntil: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).nullable().optional(),
  mainCategoryId: z.string().uuid().nullable().optional(),
  subCategoryId: z.string().uuid().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  productGroupId: z.string().uuid().nullable().optional(),
  productId: z.string().nullable().optional(),
});

export const AdminContentCommentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  postId: z.string().optional(),
  userId: z.string().uuid().optional(),
  parentIdNull: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  sort: z.enum(['createdAt', 'likesCount']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminContentCommentUpdateSchema = z.object({
  comment: z.string().min(1).max(10000).optional(),
});

export const FeedHighlightReasonEnum = z.enum(['MOST_LIKED', 'STAFF_PICK', 'BOOSTED']);

export const AdminFeedHighlightCreateSchema = z.object({
  postId: z.string().min(1).max(26),
  reason: FeedHighlightReasonEnum,
});

export const AdminFeedHighlightUpdateSchema = z.object({
  reason: FeedHighlightReasonEnum.optional(),
});

export const AdminFeedHighlightsQuerySchema = AdminPaginationQuerySchema.extend({
  postId: z.string().optional(),
  reason: FeedHighlightReasonEnum.optional(),
  sort: z.enum(['highlightedAt', 'createdAt']).default('highlightedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const TrendPeriodEnum = z.enum(['DAILY', 'WEEKLY']);

export const AdminTrendingQuerySchema = AdminPaginationQuerySchema.extend({
  trendPeriod: TrendPeriodEnum.optional(),
  sort: z.enum(['score', 'calculatedAt', 'createdAt']).default('score'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminTrendingCreateSchema = z.object({
  postId: z.string().min(1).max(26),
  trendPeriod: TrendPeriodEnum,
  score: z.number().min(0).optional(),
});

export const AdminTrendingUpdateSchema = z.object({
  score: z.number().min(0).optional(),
  trendPeriod: TrendPeriodEnum.optional(),
});

export const AdminTopCommunityChoicesQuerySchema = AdminPaginationQuerySchema.extend({
  postId: z.string().optional(),
  sort: z.enum(['awardedAt', 'createdAt']).default('awardedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminTopCommunityChoiceCreateSchema = z.object({
  postId: z.string().min(1).max(26),
  reason: z.string().max(500).optional().nullable(),
  badgeLabel: z.string().min(1).max(200),
});

export const AdminTopCommunityChoiceUpdateSchema = z.object({
  reason: z.string().max(500).optional().nullable(),
  badgeLabel: z.string().min(1).max(200).optional(),
});

const ManualReviewFlagStatusEnum = z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED']);

export const AdminManualReviewFlagsQuerySchema = AdminPaginationQuerySchema.extend({
  status: ManualReviewFlagStatusEnum.optional(),
  contentType: z.string().optional(),
  sort: z.enum(['createdAt', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminManualReviewFlagUpdateSchema = z.object({
  status: ManualReviewFlagStatusEnum.optional(),
});

export const AdminModerationActionsQuerySchema = AdminPaginationQuerySchema.extend({
  targetUserId: z.string().uuid().optional(),
  contentType: z.string().optional(),
  actionType: z.string().optional(),
  sort: z.enum(['createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminContentTagsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  postId: z.string().optional(),
  search: z.string().min(1).optional(),
});

/* ========== Type Exports ========== */

export type AdminContentPostsQuery = z.infer<typeof AdminContentPostsQuerySchema>;
export type AdminContentPostUpdateInput = z.infer<typeof AdminContentPostUpdateSchema>;
export type AdminContentCommentsQuery = z.infer<typeof AdminContentCommentsQuerySchema>;
export type AdminContentCommentUpdateInput = z.infer<typeof AdminContentCommentUpdateSchema>;
export type AdminFeedHighlightCreateInput = z.infer<typeof AdminFeedHighlightCreateSchema>;
export type AdminFeedHighlightUpdateInput = z.infer<typeof AdminFeedHighlightUpdateSchema>;
export type AdminFeedHighlightsQuery = z.infer<typeof AdminFeedHighlightsQuerySchema>;
export type AdminTrendingQuery = z.infer<typeof AdminTrendingQuerySchema>;
export type AdminTrendingCreateInput = z.infer<typeof AdminTrendingCreateSchema>;
export type AdminTrendingUpdateInput = z.infer<typeof AdminTrendingUpdateSchema>;
export type AdminTopCommunityChoicesQuery = z.infer<typeof AdminTopCommunityChoicesQuerySchema>;
export type AdminTopCommunityChoiceCreateInput = z.infer<typeof AdminTopCommunityChoiceCreateSchema>;
export type AdminTopCommunityChoiceUpdateInput = z.infer<typeof AdminTopCommunityChoiceUpdateSchema>;
export type AdminManualReviewFlagsQuery = z.infer<typeof AdminManualReviewFlagsQuerySchema>;
export type AdminManualReviewFlagUpdateInput = z.infer<typeof AdminManualReviewFlagUpdateSchema>;
export type AdminModerationActionsQuery = z.infer<typeof AdminModerationActionsQuerySchema>;
export type AdminContentTagsQuery = z.infer<typeof AdminContentTagsQuerySchema>;
