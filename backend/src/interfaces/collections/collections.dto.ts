/* ========== Collections (User-facing) DTOs ========== */

export interface CollectionListItem {
  id: string;
  title: string;
  description: string;
  currentProgress: number;
  totalProgress: number;
  coverImage: string | null;
  category?: string | null;
}

export interface CollectionsListResponse {
  collections: CollectionListItem[];
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    limit: number;
    total: number;
  };
}

export interface CollectionCategory {
  id: string;
  name: string;
  handle: string;
}

export interface CollectionCategoriesResponse {
  categories: CollectionCategory[];
}

export type CollectionBadgeStatus = 'not_started' | 'in_progress' | 'completed';

export interface CollectionBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  highlightsImage: string | null;
  currentProgress: number;
  totalProgress: number;
  status: CollectionBadgeStatus;
}

export interface CollectionDetailResponse {
  collection: CollectionListItem;
  badges: CollectionBadge[];
}

export interface UserCollectionProgressItem {
  id: string;
  title: string;
  description: string;
  currentProgress: number;
  totalProgress: number;
  coverImage: string | null;
  category: string | null;
  status: 'in_progress' | 'completed';
  totalBadges: number;
  earnedBadges: number;
}

export interface UserCollectionProgressResponse {
  collections: UserCollectionProgressItem[];
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    limit: number;
    total: number;
  };
}

export interface CompletedCollectionItem {
  id: string;
  title: string;
  description: string;
  coverImage: string | null;
  category: string | null;
  completedAt: string | null;
  totalBadges: number;
  earnedBadges: number;
}

export interface CompletedCollectionsResponse {
  collections: CompletedCollectionItem[];
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    limit: number;
    total: number;
  };
}
