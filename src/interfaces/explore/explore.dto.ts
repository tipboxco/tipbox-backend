import { FeedItem, FeedResponse } from '../feed/feed.dto';

// Trending Feed Response (same as FeedResponse but for clarity)
export interface TrendingFeedResponse extends FeedResponse {
  items: FeedItem[];
  pagination?: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

// Marketplace Banner Response
export interface MarketplaceBannerResponse {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl?: string;
}

// Event Response (What's News)
export interface EventParticipant {
  userId: string;
  avatar: string | null;
  userName: string;
}

export type EventType = 'SURVEY' | 'POLL' | 'CONTEST' | 'CHALLENGE' | 'PROMOTION';

export interface EventResponse {
  eventId: string;
  eventType: EventType;
  image: any;
  title: string;
  description: string;
  startDate: string; // ISO DateTime
  endDate: string; // ISO DateTime
  interaction: number;
  participants: EventParticipant[];
}

// New Brand Response
export interface NewBrandResponse {
  brandId: string;
  images: any;
  title: string;
  description: string;
}

// New Product Response
export interface NewProductResponse {
  productId: string;
  images: any;
  title: string;
}

