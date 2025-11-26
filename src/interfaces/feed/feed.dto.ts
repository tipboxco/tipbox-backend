import { FeedItemType } from '../../domain/feed/feed-item-type.enum';

// Re-export FeedItemType for convenience
export { FeedItemType };

// Base Types
export type ID = string;
export type URLString = string;

export type ContextType = 'PRODUCT_GROUP' | 'PRODUCT' | 'SUB_CATEGORIES';

// Context metadata used for card header
export interface ContextData {
  id: string;        // contextType'e göre: productId / productGroupId / subCategoryId
  name: string;      // kart başlığı: ürün / grup / subcategory adı
  subName?: string;  // bir üst seviye adı (örn. product -> product group)
  image?: any;       // görsel URL'si
  isOwned?: boolean; // sadece PRODUCT context'inde anlamlı
}

export interface BaseUser {
  id: ID;
  name: string;
  title: string;
  avatarUrl: URLString;
}

export interface BaseStats {
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
}

export interface BasePost {
  id: string;
  type: FeedItemType;
  user: BaseUser;
  stats: BaseStats;
  createdAt: string;
  contextType: ContextType;
}

export interface BaseProduct {
  id: string;
  name: string;
  subName: string;
  image: any; // URL or image object
  isOwned?: boolean;
}

// Post Item Types
export interface Post extends BasePost {
  contextData: ContextData;
  content: string;
  images?: any[];
}

// Benchmark Post Item Types
export interface BenchmarkProduct extends BaseProduct {
  isOwned: boolean;
  choice: boolean;
}

export interface BenchmarkPost extends BasePost {
  contextData: ContextData;
  products: BenchmarkProduct[];
  content: string;
}

// Review / Experience Post Item Types
export interface ExperienceContent {
  title: string;
  content: string;
  rating: number;
}

export interface ExperiencePost extends BasePost {
  contextData: ContextData;
  content: ExperienceContent[];
  tags: string[];
  images?: any[];
}

export interface TipsAndTricksPost extends BasePost {
  contextData: ContextData;
  content: string;
  tag: string;
  images?: any[];
}

export interface RepliesPost extends BasePost {
  contextData: ContextData;
  content: string;
  isBoosted: boolean;
  images?: any[];
}

// Feed Item Union Type
export type FeedItem =
  | { type: FeedItemType.FEED; data: Post }
  | { type: FeedItemType.BENCHMARK; data: BenchmarkPost }
  | { type: FeedItemType.POST; data: Post }
  | { type: FeedItemType.QUESTION; data: Post }
  | { type: FeedItemType.TIPS_AND_TRICKS; data: TipsAndTricksPost };

// Feed Response
export interface FeedResponse {
  items: FeedItem[];
  pagination?: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

// Feed Filter Options
export interface FeedFilterOptions {
  types?: FeedItemType[];
  categoryIds?: string[];
  productIds?: string[];
  userIds?: string[];
  minLikes?: number;
  minComments?: number;
  dateRange?: {
    from?: string;
    to?: string;
  };
}

