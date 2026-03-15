/* ========== Admin Content (Posts, Comments, Feed, Trending, Moderation) DTOs ========== */

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

export type AdminContentCommentStatsResponse = {
  total: number;
};

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

export type AdminFeedHighlightStatsResponse = {
  total: number;
  active: number;
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

export type AdminTrendingPostStatsResponse = {
  total: number;
  thisWeek: number;
};

export type AdminContentTagsCategoriesStatsResponse = {
  totalTags: number;
  totalCategories: number;
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

export type AdminManualReviewFlagDetailResponse = AdminManualReviewFlagListItem & {
  contentSummary?: string | null;
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

export type AdminModerationActionDetailResponse = AdminModerationActionListItem & {
  updatedAt: string;
  contentSummary?: string | null;
};

export type AdminContentTagListItem = {
  tag: string;
  count: number;
};
