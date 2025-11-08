import { FeedItemType } from '../../domain/feed/feed-item-type.enum';

// Re-export FeedItemType for convenience
export { FeedItemType };

// Base Types
export type ID = string;
export type URLString = string;

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
}

export interface BaseProduct {
  id: string;
  name: string;
  subName: string;
  image: any; // URL or image object
}

// Post Item Types
export interface PostProduct extends BaseProduct {
  // İleride ürünün genel ortalama grafiği için gerekli tanımlamalar burada yapılacak
}

export interface Post extends BasePost {
  product: PostProduct | null;
  content: string;
  images?: any[];
}

// Benchmark Post Item Types
export interface BenchmarkProduct extends BaseProduct {
  isOwned: boolean;
  choice: boolean;
}

export interface BenchmarkPost extends BasePost {
  products: BenchmarkProduct[];
  content: string;
}

// Review Post Item Types (Experience Post)
export interface ExperienceContent {
  title: string;
  content: string;
  rating: number;
}

export interface ReviewProduct extends BaseProduct {
  // İleride ürünün genel ortalama grafiği için gerekli tanımlamalar burada yapılacak
}

export interface ExperiencePost extends BasePost {
  product: ReviewProduct | null;
  content: ExperienceContent[];
  tags: string[];
  images?: any[];
}

// Tips And Tricks Post Item Types
export interface TipsAndTricksProduct extends BaseProduct {
  // İleride ürünün genel ortalama grafiği için gerekli tanımlamalar burada yapılacak
}

export interface TipsAndTricksPost extends BasePost {
  product: TipsAndTricksProduct | null;
  content: string;
  tag: string;
  images?: any[];
}

// Replies Post Item Types
export interface RepliesProduct extends BaseProduct {
  // İleride ürünün genel ortalama grafiği için gerekli tanımlamalar burada yapılacak
}

export interface RepliesPost extends BasePost {
  product: RepliesProduct | null;
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

