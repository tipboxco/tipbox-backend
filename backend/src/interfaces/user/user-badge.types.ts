export interface BadgeTask {
  id: string;
  title: string;
  type: 'Comment' | 'Like' | 'Share';
  current: number;
  total: number;
  isCompleted: boolean;
}

export interface BadgeListItem {
  id: string;
  title: string;
  image: string | null;
  rarity: 'Usual' | 'Rare' | 'Epic' | 'Legendary';
  isClaimed: boolean;
  nftAddress: string | null;
  totalEarned: number;
  earnedDate: string | null; // ISO8601
  tasks: BadgeTask[];
}

export interface BadgeListResponse {
  brand: {
    items: BadgeListItem[];
  };
  achievement: {
    items: BadgeListItem[];
  };
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

export interface HighlightBadgeItem {
  id: string;
  title: string;
  image: string | null;
  rarity: 'Usual' | 'Rare' | 'Epic' | 'Legendary';
}

export interface HighlightBadgeSelectionData {
  selectedBadgeIds: string[]; // max 4
  availableBadges: {
    collection: HighlightBadgeItem[];
    event: HighlightBadgeItem[];
    cosmetic: HighlightBadgeItem[];
    brand: HighlightBadgeItem[];
  };
}

export interface ProfileBadgeItem {
  id: string;
  title: string;
  image: string | null;
  type: 'achievement' | 'bridge';
  earnedAt: string | null;
  rarity: 'Usual' | 'Rare' | 'Epic' | 'Legendary';
  owner: string; // total earned count as string
}
