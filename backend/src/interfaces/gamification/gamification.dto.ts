/**
 * Data Transfer Objects for Gamification API
 */

export interface BadgeListItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  type: string;
  rarity: string;
  pointValue: number;
  category: { id: string; name: string };
  earnedByUserCount: number;
}

export interface BadgeDetailResponse {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  type: string;
  rarity: string;
  pointValue: number;
  boostMultiplier: number | null;
  rewardMultiplier: number | null;
  category: { id: string; name: string };
  collection: { id: string; name: string } | null;
  earnedByUserCount: number;
  recentEarners: Array<{
    userId: string;
    username: string;
    claimedAt: Date | null;
  }>;
}

export interface CollectionListItem {
  id: string;
  name: string;
  bannerUrl: string | null;
  shortDescription: string | null;
  focusSector: string | null;
  targetGroup: string | null;
  badgeCount: number;
  goalCount: number;
  isLocked: boolean;
  userProgress?: {
    completedGoals: number;
    totalGoals: number;
    percentage: number;
    isCompleted: boolean;
  };
}

export interface CollectionDetailResponse {
  id: string;
  name: string;
  bannerUrl: string | null;
  owner: string | null;
  focusSector: string | null;
  targetGroup: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  unlockCondition: string | null;
  completionBonus: string | null;
  category: { id: string; name: string } | null;
  badges: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    rarity: string;
  }>;
  goals: Array<{
    id: string;
    title: string | null;
    requirement: string | null;
    actionType: { mainAction: string; label: string };
    pointsRequired: number;
    difficulty: string;
    rewardBadge: { id: string; name: string } | null;
    userProgress?: {
      current: number;
      percentage: number;
      completed: boolean;
      completedAt: Date | null;
    };
  }>;
  isLocked: boolean;
  userCompletion?: {
    completedGoals: number;
    totalGoals: number;
    percentage: number;
    isCompleted: boolean;
  };
}

export interface UserBadgeResponse {
  id: string; // UserBadge ID
  badgeId: string; // Badge ID
  badge: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    type: string;
    rarity: string;
    pointValue: number;
  };
  claimed: boolean;
  claimedAt: Date | null;
  isVisible: boolean;
  displayOrder: number | null;
  visibility: string;
  earnedAt: Date;
}

export interface UserAchievementResponse {
  id: string; // UserAchievement ID
  goalId: string;
  goal: {
    id: string;
    title: string | null;
    requirement: string | null;
    actionType: {
      mainAction: string;
      label: string;
    };
    pointsRequired: number;
    difficulty: string;
    collection: {
      id: string;
      name: string;
    };
    rewardBadge: {
      id: string;
      name: string;
    } | null;
  };
  progress: number;
  percentage: number;
  completed: boolean;
  completedAt: Date | null;
  remaining: number;
}

export interface GamificationStatsResponse {
  badges: {
    total: number;
    claimed: number;
    unclaimed: number;
    byRarity: {
      COMMON: number;
      RARE: number;
      EPIC: number;
    };
    byType: {
      COLLECTION: number;
      EVENT: number;
      COSMETIC: number;
      BRAND: number;
    };
  };
  achievements: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
  };
  level: number;
  experience: number;
  nextLevelExperience: number;
  collections: {
    total: number;
    completed: number;
    inProgress: number;
  };
}

export interface NearCompletionGoal {
  goalId: string;
  title: string;
  progress: number;
  pointsRequired: number;
  percentage: number;
  remaining: number;
  estimatedActionsNeeded: number;
  rewardBadge: {
    id: string;
    name: string;
  } | null;
  collection: {
    id: string;
    name: string;
  };
}

export interface ClaimBadgeResponse {
  userBadgeId: string;
  claimedAt: Date;
}

export interface UpdateBadgeVisibilityRequest {
  visibility: 'PUBLIC' | 'FRIENDS' | 'TRUSTERS' | 'PRIVATE';
  isVisible?: boolean;
}

export interface UpdateBadgeDisplayOrderRequest {
  badgeOrders: Array<{
    userBadgeId: string;
    displayOrder: number; // 1-6
  }>;
}
