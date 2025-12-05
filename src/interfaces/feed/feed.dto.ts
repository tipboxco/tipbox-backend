import { FeedItemType } from '../../domain/feed/feed-item-type.enum';
import { ContextType as DomainContextType } from '../../domain/content/context-type.enum';

// Re-export FeedItemType for convenience
export { FeedItemType };

// Base Types
export type ID = string;
export type URLString = string;

export type ContextType = DomainContextType;

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
  /**
   * Yeni tercih edilen alan adı - avatar
   */
  avatar?: URLString;
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
export type ContentType = 'Price and Shopping Experience' | 'Product and Usage Experience';

export interface ExperienceContent {
  title: ContentType;
  content: string;
  rating: number;
}

export interface ReviewProduct extends BaseProduct {
  // future: aggregate review stats can be added here
}

export interface ExperiencePost extends BasePost {
  product: ReviewProduct;
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
  | { type: FeedItemType.BENCHMARK; data: BenchmarkPost }
  | { type: FeedItemType.POST; data: Post }
  | { type: FeedItemType.QUESTION; data: Post }
  | { type: FeedItemType.TIPS_AND_TRICKS; data: TipsAndTricksPost }
  | { type: FeedItemType.EXPERIENCE; data: ExperiencePost }
  | { type: FeedItemType.UPDATE; data: ExperiencePost };

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
  /**
   * User interests (e.g. category or topic IDs)
   */
  interests?: string[];
  /**
   * Tags to filter posts by
   */
  tags?: string[];
  /**
   * Single primary category filter
   */
  category?: string;
  /**
   * Sort strategy for filtered feed
   * - recent: newest first
   * - top: based on engagement (likes/views)
   */
  sort?: 'recent' | 'top';
  /**
   * Filter by product IDs
   */
  productIds?: string[];
  /**
   * Filter by user IDs
   */
  userIds?: string[];
  /**
   * Filter by date range
   */
  dateRange?: {
    from?: string;
    to?: string;
  };
  /**
   * Minimum number of likes required
   */
  minLikes?: number;
  /**
   * Minimum number of comments required
   */
  minComments?: number;
  /**
   * Filter by feed item types
   */
  types?: FeedItemType[];
}

