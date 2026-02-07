import { z } from 'zod';

export const AdminUpdateUserSchema = z.object({
  email: z.string().email().optional(),
  status: z.string().nullable().optional(),
  emailVerified: z.boolean().optional(),
});

export const AdminPutRolesSchema = z.object({
  roles: z.array(z.string().min(1)).min(0),
});

export const AdminResolveReportSchema = z.object({
  resolved: z.boolean(),
  adminNote: z.string().max(500).optional(),
});

const KycReviewStatusEnum = z.enum(['INIT', 'PENDING', 'COMPLETED', 'DECLINED', 'ON_HOLD']);
const KycReviewResultEnum = z.enum(['NULL', 'GREEN', 'YELLOW', 'RED']);

export const AdminKycReviewSchema = z.object({
  reviewStatus: KycReviewStatusEnum.optional(),
  reviewResult: KycReviewResultEnum.optional(),
  reviewReason: z.string().max(500).optional(),
});

export const AdminUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().min(1).optional(),
  status: z.string().optional(),
  emailVerified: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  sort: z.enum(['createdAt', 'email']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminPaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const AdminUserReportsQuerySchema = AdminPaginationQuerySchema.extend({
  reportedUserId: z.string().uuid().optional(),
  reporterId: z.string().uuid().optional(),
  category: z.string().optional(),
  sort: z.enum(['createdAt', 'category']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminUserKycQuerySchema = AdminPaginationQuerySchema.extend({
  userId: z.string().uuid().optional(),
  reviewStatus: KycReviewStatusEnum.optional(),
  reviewResult: KycReviewResultEnum.optional(),
});

export const AdminUserTrustScoresQuerySchema = AdminPaginationQuerySchema.extend({
  userId: z.string().uuid().optional(),
  sort: z.enum(['calculatedAt', 'score', 'createdAt']).default('calculatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminLoginAttemptsQuerySchema = AdminPaginationQuerySchema.extend({
  status: z.enum(['SUCCESS', 'FAILED', 'LOCKED']).optional(),
});

/** Avatar: create (new imageUrl) */
export const AdminAvatarCreateSchema = z.object({
  imageUrl: z.string().url().min(1),
});

/** Avatar: update (set active or change imageUrl) */
export const AdminAvatarUpdateSchema = z.object({
  imageUrl: z.string().url().optional(),
  avatarId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

/** Grant badge to user */
export const AdminGrantBadgeSchema = z.object({
  badgeId: z.string().uuid(),
  isVisible: z.boolean().optional().default(true),
  displayOrder: z.number().int().optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'TRUSTERS', 'PRIVATE']).optional().default('PUBLIC'),
});

export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserSchema>;
export type AdminPutRolesInput = z.infer<typeof AdminPutRolesSchema>;
export type AdminResolveReportInput = z.infer<typeof AdminResolveReportSchema>;
export type AdminKycReviewInput = z.infer<typeof AdminKycReviewSchema>;
export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>;
export type AdminUserReportsQuery = z.infer<typeof AdminUserReportsQuerySchema>;
export type AdminUserKycQuery = z.infer<typeof AdminUserKycQuerySchema>;
export type AdminUserTrustScoresQuery = z.infer<typeof AdminUserTrustScoresQuerySchema>;
export type AdminLoginAttemptsQuery = z.infer<typeof AdminLoginAttemptsQuerySchema>;
export type AdminAvatarCreateInput = z.infer<typeof AdminAvatarCreateSchema>;
export type AdminAvatarUpdateInput = z.infer<typeof AdminAvatarUpdateSchema>;
export type AdminGrantBadgeInput = z.infer<typeof AdminGrantBadgeSchema>;

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

export type AdminCreateEventInput = z.infer<typeof AdminCreateEventSchema>;
export type AdminUpdateEventInput = z.infer<typeof AdminUpdateEventSchema>;
export type AdminEventsQuery = z.infer<typeof AdminEventsQuerySchema>;
export type AdminAddEventBadgeInput = z.infer<typeof AdminAddEventBadgeSchema>;
export type AdminUpdateEventBadgeInput = z.infer<typeof AdminUpdateEventBadgeSchema>;
