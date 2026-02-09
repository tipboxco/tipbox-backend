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

/* ========== Admin Collections (BadgeCollection) ========== */

export const AdminCollectionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().min(1).optional(),
  categoryId: z.string().optional(),
  sort: z.enum(['createdAt', 'name']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminCreateCollectionSchema = z.object({
  name: z.string().min(1).max(500),
  bannerUrl: z.string().url().optional().nullable(),
  owner: z.string().max(500).optional().nullable(),
  collectionObjective: z.string().max(2000).optional().nullable(),
  targetVertical: z.string().max(500).optional().nullable(),
  productScope: z.string().max(500).optional().nullable(),
  collectionType: z.string().max(200).optional().nullable(),
  hookPitch: z.string().max(1000).optional().nullable(),
  visualTheme: z.string().max(500).optional().nullable(),
  completionBonus: z.string().max(500).optional().nullable(),
  primaryKpi: z.string().max(500).optional().nullable(),
  secondaryKpi: z.string().max(500).optional().nullable(),
  targetAudience: z.string().max(1000).optional().nullable(),
  campaignContext: z.string().max(1000).optional().nullable(),
  successMetric: z.string().max(500).optional().nullable(),
  sponsorship: z.string().max(500).optional().nullable(),
  unlockCondition: z.string().max(1000).optional().nullable(),
  scheduleLaunchDate: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v == null || v === '' ? null : new Date(v))),
  timeStockLimit: z.string().max(200).optional().nullable(),
  categoryId: z.string().min(1),
});

export const AdminUpdateCollectionSchema = AdminCreateCollectionSchema.partial();

export const AdminAddCollectionBadgeSchema = z.object({
  badgeId: z.string().uuid(),
});

const AchievementDifficultyEnum = z.enum(['EASY', 'MEDIUM', 'HARD']);

export const AdminCreateCollectionGoalSchema = z.object({
  actionTypeId: z.string().uuid(),
  rewardBadgeId: z.string().uuid(),
  pointsRequired: z.coerce.number().int().min(1),
  title: z.string().min(1).max(500).optional(),
  requirement: z.string().max(1000).optional(),
  difficulty: AchievementDifficultyEnum.default('MEDIUM'),
});

export type AdminCreateCollectionGoalInput = z.infer<typeof AdminCreateCollectionGoalSchema>;

/* ========== Admin Badges ========== */

const BadgeTypeEnum = z.enum(['COLLECTION', 'EVENT', 'COSMETIC', 'BRAND']);
const BadgeRarityEnum = z.enum(['COMMON', 'RARE', 'EPIC']);

export const AdminBadgesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  type: BadgeTypeEnum.optional(),
  rarity: BadgeRarityEnum.optional(),
  categoryId: z.string().uuid().optional(),
  collectionId: z.string().uuid().optional(),
  search: z.string().min(1).optional(),
  sort: z.enum(['createdAt', 'name']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminCreateBadgeSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  type: BadgeTypeEnum,
  rarity: BadgeRarityEnum,
  boostMultiplier: z.number().min(0).optional().nullable(),
  rewardMultiplier: z.number().min(0).optional().nullable(),
  categoryId: z.string().uuid(),
  collectionId: z.string().uuid().optional().nullable(),
});

export const AdminUpdateBadgeSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  type: BadgeTypeEnum.optional(),
  rarity: BadgeRarityEnum.optional(),
  boostMultiplier: z.number().min(0).optional().nullable(),
  rewardMultiplier: z.number().min(0).optional().nullable(),
  categoryId: z.string().uuid().optional(),
  collectionId: z.string().uuid().optional().nullable(),
});

export const AdminBadgeOwnersQuerySchema = AdminPaginationQuerySchema.extend({
  claimed: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  sort: z.enum(['createdAt', 'claimedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type AdminCollectionsQuery = z.infer<typeof AdminCollectionsQuerySchema>;
export type AdminCreateCollectionInput = z.infer<typeof AdminCreateCollectionSchema>;
export type AdminUpdateCollectionInput = z.infer<typeof AdminUpdateCollectionSchema>;
export type AdminAddCollectionBadgeInput = z.infer<typeof AdminAddCollectionBadgeSchema>;
export type AdminBadgesQuery = z.infer<typeof AdminBadgesQuerySchema>;
export type AdminCreateBadgeInput = z.infer<typeof AdminCreateBadgeSchema>;
export type AdminUpdateBadgeInput = z.infer<typeof AdminUpdateBadgeSchema>;
export type AdminBadgeOwnersQuery = z.infer<typeof AdminBadgeOwnersQuerySchema>;

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
