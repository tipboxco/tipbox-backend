/** Admin API response types (backend admin.dto uyumlu) */

export type AdminUserListItem = {
  id: string;
  email: string | null;
  status: string | null;
  emailVerified: boolean;
  createdAt: string;
  displayName?: string | null;
  userName?: string | null;
  avatarUrl?: string | null;
};

export type AdminProfileResponse = {
  id: string;
  userId: string;
  displayName: string | null;
  userName: string | null;
  bio: string | null;
  bannerUrl: string | null;
  country: string | null;
  birthDate: string | null;
  postsCount: number;
  trustCount: number;
  trusterCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminModerationHistoryItem = {
  id: string;
  moderatorId: string;
  moderatorEmail?: string | null;
  targetUserId: string;
  actionType: string;
  reason: string;
  contentType: string | null;
  contentId: number | null;
  createdAt: string;
};

export type AdminUserDetailResponse = AdminUserListItem & {
  auth0Id: string | null;
  updatedAt: string;
  profile?: AdminProfileResponse | null;
  roles?: string[];
  lastBan?: AdminModerationHistoryItem | null;
};

export type AdminRolesResponse = { roles: string[] };

/** Genel admin istatistikleri — GET /admin/stats */
export type AdminStatsResponse = {
  users: number;
  posts: number;
  bannedUsers: number;
  adminLogs: number;
};

export type AdminUsersStatsResponse = {
  total: number;
  bannedCount: number;
  emailVerifiedCount: number;
  newThisWeek: number;
};

/** Admin action log — GET /admin/logs */
export type AdminLogListItem = {
  id: string;
  adminId: string;
  action: string;
  description: string | null;
  entityType: string;
  entityId: number;
  createdAt: string;
};

export type AdminUserReportListItem = {
  id: string;
  reportedUserId: string;
  reporterId: string;
  category: string;
  description: string | null;
  createdAt: string;
  reportedUserEmail?: string | null;
  reportedUserDisplayName?: string | null;
  reporterEmail?: string | null;
  reporterDisplayName?: string | null;
  resolved?: boolean;
  resolvedAt?: string | null;
};

export type AdminUserReportDetailResponse = AdminUserReportListItem & {
  reportedUser: { id: string; email: string | null; displayName?: string | null };
  reporter: { id: string; email: string | null; displayName?: string | null };
};

export type AdminKycListItem = {
  id: string;
  userId: string;
  userEmail?: string | null;
  sumsubApplicantId: string;
  reviewStatus: string;
  reviewResult: string;
  reviewReason: string | null;
  kycLevel: string | null;
  createdAt: string;
  lastSyncedAt: string | null;
};

export type AdminKycDetailResponse = AdminKycListItem & {
  updatedAt: string;
  lastUpdatedAt: string;
};

export type AdminLoginAttemptListItem = {
  id: string;
  userId: string | null;
  ipAddress: string;
  userAgent: string;
  status: string;
  attemptedAt: string;
};

export type AdminAvatarResponse = {
  id: string;
  userId: string;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserEventListItem = {
  id: string;
  userId: string;
  eventId: string;
  eventTitle: string | null;
  eventStatus: string | null;
  eventStartDate: string | null;
  eventEndDate: string | null;
  eventPostsCount: number;
  eventLikesReceived: number;
  totalParticipated: number;
  totalComments: number;
  createdAt: string;
};

export type AdminUserBadgeListItem = {
  id: string;
  userId: string;
  badgeId: string;
  badgeName: string;
  badgeImageUrl: string | null;
  badgeRarity: string;
  badgeCategoryName: string | null;
  isVisible: boolean;
  displayOrder: number | null;
  visibility: string;
  claimed: boolean;
  claimedAt: string | null;
  createdAt: string;
};

export type AdminWalletSummaryItem = {
  id: string;
  userId: string;
  provider: string;
  publicAddress: string;
  balance: number;
  lockedBalance: number;
  isConnected: boolean;
  createdAt: string;
};

export type AdminTipsSummaryResponse = {
  totalSent: number;
  totalReceived: number;
  sentCount: number;
  receivedCount: number;
};

export type AdminTipsTransactionListItem = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  reason: string | null;
  createdAt: string;
  fromUserEmail?: string | null;
  fromUserDisplayName?: string | null;
  toUserEmail?: string | null;
  toUserDisplayName?: string | null;
};

export type PaginationMeta = {
  total: number;
  limit: number;
  offset: number;
};

/* ========== Admin Events ========== */

export type AdminEventStatsResponse = {
  total: number;
  draft: number;
  published: number;
  closed: number;
};

export type AdminEventListItem = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: string;
  feedType: string;
  imageUrl: string | null;
  productId: string | null;
  brandId: string | null;
  mainCategoryId: string | null;
  subCategoryId: string | null;
  createdAt: string;
  participantsCount?: number;
};

export type AdminEventDetailResponse = AdminEventListItem & {
  updatedAt: string;
  product?: { id: string; name?: string } | null;
  brand?: { id: string; name?: string } | null;
  mainCategory?: { id: string; name?: string } | null;
  subCategory?: { id: string; name?: string } | null;
};

export type AdminEventParticipantListItem = {
  id: string;
  userId: string;
  eventId: string;
  totalParticipated: number;
  totalComments: number;
  helpfulVotesReceived: number;
  eventPostsCount: number;
  eventLikesReceived: number;
  createdAt: string;
  userEmail?: string | null;
  userDisplayName?: string | null;
};

export type AdminEventAnalyticsResponse = {
  participantCount: number;
  totalPosts: number;
  totalRewardsGranted: number;
  badgesCount: number;
};

export type AdminEventBadgeListItem = {
  id: string;
  eventId: string;
  badgeId: string;
  rank: number;
  displayOrder: number | null;
  enabled: boolean;
  createdAt: string;
  badgeName: string;
  badgeImageUrl: string | null;
  badgeRarity: string;
  badgeCategoryName: string | null;
};

export type AdminEventRewardListItem = {
  id: string;
  userId: string;
  eventId: string;
  rewardType: string;
  rewardId: number;
  amount: number | null;
  awardedAt: string;
  createdAt: string;
  userEmail?: string | null;
  userDisplayName?: string | null;
};

/* ========== Admin Collections (BadgeCollection) ========== */

export type AdminCollectionStatsResponse = {
  total: number;
};

export type AdminCollectionListItem = {
  id: string;
  name: string;
  bannerUrl: string | null;
  owner: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  badgesCount: number;
  goalsCount?: number;
  createdAt: string;
};

export type AdminCollectionDetailResponse = AdminCollectionListItem & {
  focusSector: string | null;
  targetGroup: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  unlockCondition: string | null;
  completionBonus: string | null;
  updatedAt: string;
  category?: { id: string; name: string } | null;
};

export type AdminCollectionBadgeListItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  highlightsImage: string | null;
  type: string;
  rarity: string;
  status: string;
  displayOrder: number;
  categoryId: string;
  categoryName?: string | null;
  createdAt: string;
};

export type AdminActionTypeListItem = {
  id: string;
  mainAction: string;
  code: string;
  label: string;
};

export type AdminBadgeCategoryListItem = {
  id: string;
  name: string;
  description: string | null;
};

/* ========== Admin Badges ========== */

export type AdminBadgeStatsResponse = {
  total: number;
  byType: Record<string, number>;
  byRarity: Record<string, number>;
};

export type AdminBadgeListItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  highlightsImage: string | null;
  type: string;
  rarity: string;
  status: string;
  displayOrder: number;
  categoryId: string;
  categoryName?: string | null;
  collectionId: string | null;
  collectionName?: string | null;
  createdAt: string;
  eventId?: string | null;
  eventTitle?: string | null;
  eventImageUrl?: string | null;
};

export type AdminBadgeDetailResponse = AdminBadgeListItem & {
  boostMultiplier: number | null;
  rewardMultiplier: number | null;
  updatedAt: string | null;
  category?: { id: string; name: string } | null;
  collection?: { id: string; name: string } | null;
};

export type AdminBadgeOwnerListItem = {
  id: string;
  userId: string;
  badgeId: string;
  claimed: boolean;
  claimedAt: string | null;
  createdAt: string;
  userEmail: string | null;
  userDisplayName: string | null;
};

/* ========== Admin Content ========== */

export type AdminPostSearchItem = {
  id: string;
  title: string;
  bodyExcerpt: string;
  type: string;
  userDisplayName: string | null;
  userName: string | null;
  avatarUrl: string | null;
};

export type AdminContentPostsStatsResponse = {
  total: number;
  byType: Record<string, number>;
  boostedCount: number;
  withEventCount: number;
};

export type AdminContentPostListItem = {
  id: string;
  userId: string;
  type: string;
  title: string;
  bodyExcerpt: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  favoritesCount: number;
  viewsCount: number;
  isBoosted: boolean;
  boostedUntil: string | null;
  eventId: string | null;
  mainCategoryId: string | null;
  subCategoryId: string | null;
  productId: string | null;
  userDisplayName: string | null;
  userName: string | null;
};

export type AdminContentPostDetailResponse = AdminContentPostListItem & {
  body: string;
  categoryId: string | null;
  productGroupId: string | null;
  productStatus: string | null;
  inventoryRequired: boolean;
  sharesCount: number;
  updatedAt: string;
  experienceDurationId: string | null;
  experienceLocationId: string | null;
  experiencePurposeId: string | null;
  experienceSnippetId: string | null;
  user?: { id: string; email: string | null; displayName: string | null; userName: string | null };
  mainCategory?: { id: string; name: string } | null;
  subCategory?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  product?: { id: string; name: string } | null;
  productGroup?: { id: string; name: string } | null;
  event?: { id: string; title: string; status: string } | null;
  media?: { id: string; mediaUrl: string; orderIndex: number }[];
  tags?: string[];
  question?: { id: string; expectedAnswerFormat: string; relatedProductId: string | null } | null;
  comparison?: { id: string; product1Id: string; product2Id: string; comparisonSummary: string | null } | null;
  tip?: { id: string; tipCategory: string; isVerified: boolean } | null;
};

export type AdminContentCommentListItem = {
  id: string;
  postId: string;
  userId: string;
  parentId: string | null;
  comment: string;
  commentExcerpt: string | null;
  isAnswer: boolean;
  likesCount: number;
  createdAt: string;
  userDisplayName: string | null;
  userName: string | null;
  postTitle: string | null;
};

export type AdminContentCommentDetailResponse = AdminContentCommentListItem & {
  updatedAt: string;
  post?: { id: string; title: string; type: string };
  user?: { id: string; email: string | null; displayName: string | null; userName: string | null };
  repliesCount?: number;
};

export type AdminContentCommentStatsResponse = { total: number };

export type AdminFeedHighlightListItem = {
  id: string;
  postId: string;
  reason: string;
  highlightedAt: string;
  createdAt: string;
  postTitle: string | null;
  postType: string | null;
  bodyExcerpt: string | null;
  userDisplayName: string | null;
  avatarUrl: string | null;
};

export type AdminTrendingPostListItem = {
  id: string;
  postId: string;
  score: number;
  trendPeriod: string;
  calculatedAt: string;
  createdAt: string;
  expiresAt: string;
  daysRemaining: number;
  isExpired: boolean;
  postTitle: string | null;
  postType: string | null;
  bodyExcerpt: string | null;
  userDisplayName: string | null;
  avatarUrl: string | null;
};

export type AdminTopCommunityChoiceListItem = {
  id: string;
  postId: string;
  reason: string | null;
  badgeLabel: string;
  awardedAt: string;
  createdAt: string;
  postTitle: string | null;
};

export type AdminManualReviewFlagListItem = {
  id: string;
  flaggedByUserId: string;
  contentType: string;
  contentId: number;
  reason: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  flaggedByUserEmail: string | null;
  flaggedByUserDisplayName: string | null;
};

export type AdminModerationActionListItem = {
  id: string;
  moderatorId: string;
  targetUserId: string;
  actionType: string;
  reason: string;
  contentType: string | null;
  contentId: number | null;
  createdAt: string;
  moderatorEmail: string | null;
  targetUserEmail: string | null;
  targetUserDisplayName: string | null;
};

export type AdminContentTagListItem = {
  tag: string;
  count: number;
};
