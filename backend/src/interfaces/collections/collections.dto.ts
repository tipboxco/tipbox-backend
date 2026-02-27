/* ========== Collections (User-facing) DTOs ========== */

export interface CollectionBackgroundGradient {
  colors: string[];
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export interface CollectionListItem {
  id: string;
  title: string;
  description: string;
  currentProgress: number;
  totalProgress: number;
  backgroundGradient: CollectionBackgroundGradient;
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
  currentProgress: number;
  totalProgress: number;
  status: CollectionBadgeStatus;
}

export interface CollectionDetailResponse {
  collection: CollectionListItem;
  badges: CollectionBadge[];
}
