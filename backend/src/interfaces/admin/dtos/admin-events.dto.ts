/* ========== Admin Events DTOs ========== */

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
