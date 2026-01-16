export interface EventBadgeItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  rarity: string;
  category: string;
  userProgress: {
    current: number;
    target: number;
    isCompleted: boolean;
    completedAt: string | undefined;
    progressPercentage: number;
  };
  eventId: string;
  createdAt: string;
}

export interface EventBadgesResponse {
  items: EventBadgeItem[];
  pagination: {
    cursor: string | undefined;
    hasMore: boolean;
    limit: number;
  };
}

export interface CreateEventBadgeDTO {
  eventId: string;
  badgeId: string;
  requirementType: 'POSTS_COUNT' | 'LIKES_RECEIVED';
  threshold: number;
  displayOrder?: number;
  enabled?: boolean;
}

export interface UpdateEventBadgeDTO {
  requirementType?: 'POSTS_COUNT' | 'LIKES_RECEIVED';
  threshold?: number;
  displayOrder?: number;
  enabled?: boolean;
}

export interface EventBadgeWithBadge {
  id: string;
  eventId: string;
  badgeId: string;
  requirementType: string;
  threshold: number;
  displayOrder: number | null;
  enabled: boolean;
  badge: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    rarity: string;
    category: {
      name: string;
    } | null;
  };
}
