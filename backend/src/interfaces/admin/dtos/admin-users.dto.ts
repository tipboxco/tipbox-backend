/* ========== Users Management DTOs ========== */

export type AdminUserListItem = {
  id: string;
  email: string | null;
  status: string | null;
  emailVerified: boolean;
  createdAt: string;
  displayName?: string | null;
  userName?: string | null;
};

export type AdminUserDetailResponse = AdminUserListItem & {
  auth0Id: string | null;
  updatedAt: string;
  profile?: AdminProfileResponse | null;
  roles?: string[];
  lastBan?: AdminModerationHistoryItem | null;
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

export type AdminRolesResponse = {
  roles: string[];
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

export type AdminUserReportStatsResponse = {
  total: number;
  open: number;
  resolved: number;
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

export type AdminUserKycStatsResponse = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

export type AdminTrustScoreListItem = {
  id: string;
  userId: string;
  userEmail?: string | null;
  score: number;
  reason: string | null;
  calculatedAt: string;
  createdAt: string;
};

export type AdminLoginAttemptListItem = {
  id: string;
  userId: string | null;
  ipAddress: string;
  userAgent: string;
  status: string;
  attemptedAt: string;
};

export type AdminUsersStatsResponse = {
  total: number;
  bannedCount: number;
  emailVerifiedCount: number;
  newThisWeek: number;
};

export type AdminUserBannedStatsResponse = {
  total: number;
  thisMonth: number;
};

/** User avatar (admin) */
export type AdminAvatarResponse = {
  id: string;
  userId: string;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** User's participated events (EventStats + Event summary) */
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

/** User's badges (UserBadge + Badge info) */
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

/** User wallet summary (admin) */
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

/** Tips summary for a user */
export type AdminTipsSummaryResponse = {
  totalSent: number;
  totalReceived: number;
  sentCount: number;
  receivedCount: number;
};

/** Single tips transaction (admin) */
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
