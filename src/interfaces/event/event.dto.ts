import { FeedItem } from '../feed/feed.dto';

// Event Types
export type EventType = 'default' | 'product';

// Event Card
export interface EventParticipant {
  userId: string;
  avatar: string | null;
  userName: string;
}

export interface EventCard {
  eventId: string;
  image: string | null;
  title: string;
  description: string | null;
  startDate: string; // ISO 8601 DateTime
  endDate: string; // ISO 8601 DateTime
  interaction?: number; // Total interactions (participants, comments, etc.)
  eventType: EventType;
  participants?: EventParticipant[];
}

// Active Events Response
export interface ActiveEvent {
  items: EventCard[];
  pagination?: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

// Upcoming Events Response
export interface UpComingEvents {
  items: EventCard[];
  pagination?: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

// Event Detail
export type EventStatus = 'active' | 'upcoming';
export interface RewardBadge {
  id: string;
  image: string | null;
  title: string;
}

export interface EventDetail {
  eventId: string;
  banner: string | null;
  title: string;
  description: string | null;
  startDate: string; // ISO 8601 DateTime
  endDate: string; // ISO 8601 DateTime
  interaction: number;
  eventType: EventType;
  isJoined: boolean;
  status: EventStatus;
  rewards: RewardBadge[];
}

// Event Posts Response
export type PostItemType = 'feed' | 'benchmark' | 'post' | 'question' | 'tipsAndTricks';

export interface EventPosts {
  items: FeedItem[];
  pagination?: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

// Badge Response
export interface Badge {
  id: string;
  title: string;
  description: string | null;
  image: string | null; // Badge görseli
  current: number; // Current progress
  total: number; // Total required
}

export interface Badges {
  items: Badge[];
  pagination?: {
    cursor?: string;
    hasMore: boolean;
    limit: number;
  };
}

// Limited Time Event DTO'ları
export interface LimitedTimeEventUser {
  id: string;
  avatar: string | null;
  rank: number;
  score: number;
}

export interface LimitedTimeEventLeaderboardUser {
  id: string;
  avatar: string | null;
  rank: number;
}

export interface LimitedTimeEventResponse {
  id: string;
  title: string;
  description: string | null;
  leaderboardUsers: LimitedTimeEventLeaderboardUser[];
  userScore: LimitedTimeEventUser | null;
  backgroundImage: string | null;
  eventImage: string | null;
  startDate: string;
  endDate: string;
}


