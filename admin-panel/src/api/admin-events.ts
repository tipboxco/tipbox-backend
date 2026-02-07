import { get, post, patch, del } from './client';
import type {
  AdminEventStatsResponse,
  AdminEventListItem,
  AdminEventDetailResponse,
  AdminEventParticipantListItem,
  AdminEventAnalyticsResponse,
  AdminEventBadgeListItem,
  AdminEventRewardListItem,
  PaginationMeta,
} from '../types/admin';

const prefix = '/admin';

export async function fetchEventsStats() {
  return get<AdminEventStatsResponse>(`${prefix}/events/stats`);
}

export async function fetchEvents(params: {
  limit?: number;
  offset?: number;
  status?: string;
  feedType?: string;
  search?: string;
  sort?: 'createdAt' | 'startDate' | 'endDate' | 'title';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  if (params.status) query.status = params.status;
  if (params.feedType) query.feedType = params.feedType;
  if (params.search) query.search = params.search;
  const res = await get<AdminEventListItem[]>(`${prefix}/events`, query);
  return res;
}

export async function fetchEvent(id: string) {
  return get<AdminEventDetailResponse>(`${prefix}/events/${id}`);
}

export async function createEvent(body: {
  title: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  status?: string;
  feedType?: string;
  productId?: string | null;
  brandId?: string | null;
  mainCategoryId?: string | null;
  subCategoryId?: string | null;
  imageUrl?: string | null;
}) {
  return post<AdminEventDetailResponse>(`${prefix}/events`, body);
}

export async function updateEvent(
  id: string,
  body: Partial<{
    title: string;
    description: string | null;
    startDate: string;
    endDate: string;
    status: string;
    feedType: string;
    productId: string | null;
    brandId: string | null;
    mainCategoryId: string | null;
    subCategoryId: string | null;
    imageUrl: string | null;
  }>
) {
  return patch<AdminEventDetailResponse>(`${prefix}/events/${id}`, body);
}

export async function deleteEvent(id: string) {
  return del<{ message: string }>(`${prefix}/events/${id}`);
}

export async function fetchEventParticipants(
  eventId: string,
  params?: { limit?: number; offset?: number; sort?: string; order?: 'asc' | 'desc' }
) {
  const query = params
    ? {
        limit: params.limit ?? 20,
        offset: params.offset ?? 0,
        sort: params.sort ?? 'eventPostsCount',
        order: params.order ?? 'desc',
      }
    : undefined;
  return get<AdminEventParticipantListItem[]>(`${prefix}/events/${eventId}/participants`, query);
}

export async function fetchEventAnalytics(eventId: string) {
  return get<AdminEventAnalyticsResponse>(`${prefix}/events/${eventId}/analytics`);
}

export async function fetchEventBadges(eventId: string) {
  return get<AdminEventBadgeListItem[]>(`${prefix}/events/${eventId}/badges`);
}

export async function addEventBadge(
  eventId: string,
  body: { badgeId: string; rank: number; displayOrder?: number | null }
) {
  return post<AdminEventBadgeListItem>(`${prefix}/events/${eventId}/badges`, body);
}

export async function updateEventBadge(
  eventId: string,
  eventBadgeId: string,
  body: { rank?: number; displayOrder?: number | null; enabled?: boolean }
) {
  return patch<AdminEventBadgeListItem>(`${prefix}/events/${eventId}/badges/${eventBadgeId}`, body);
}

export async function removeEventBadge(eventId: string, eventBadgeId: string) {
  return del<{ message: string }>(`${prefix}/events/${eventId}/badges/${eventBadgeId}`);
}

export async function fetchEventRewards(
  eventId: string,
  params?: {
    limit?: number;
    offset?: number;
    userId?: string;
    rewardType?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }
) {
  const query = params
    ? {
        limit: params.limit ?? 20,
        offset: params.offset ?? 0,
        sort: params.sort ?? 'awardedAt',
        order: params.order ?? 'desc',
        ...(params.userId && { userId: params.userId }),
        ...(params.rewardType && { rewardType: params.rewardType }),
      }
    : undefined;
  return get<AdminEventRewardListItem[]>(`${prefix}/events/${eventId}/rewards`, query);
}
