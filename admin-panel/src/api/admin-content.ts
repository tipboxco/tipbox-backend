import { get, post, patch, del } from './client';
import type {
  AdminContentPostsStatsResponse,
  AdminContentPostListItem,
  AdminContentPostDetailResponse,
  AdminContentCommentListItem,
  AdminContentCommentDetailResponse,
  AdminContentCommentStatsResponse,
  AdminFeedHighlightListItem,
  AdminTrendingPostListItem,
  AdminTopCommunityChoiceListItem,
  AdminManualReviewFlagListItem,
  AdminModerationActionListItem,
  AdminContentTagListItem,
} from '../types/admin';

const prefix = '/admin';

export async function fetchContentPostsStats() {
  return get<AdminContentPostsStatsResponse>(`${prefix}/content/posts/stats`);
}

export async function fetchContentPosts(params: {
  limit?: number;
  offset?: number;
  type?: string;
  userId?: string;
  eventId?: string;
  mainCategoryId?: string;
  subCategoryId?: string;
  productId?: string;
  search?: string;
  sort?: 'createdAt' | 'likesCount' | 'commentsCount' | 'viewsCount' | 'title';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  if (params.type) query.type = params.type;
  if (params.userId) query.userId = params.userId;
  if (params.eventId) query.eventId = params.eventId;
  if (params.mainCategoryId) query.mainCategoryId = params.mainCategoryId;
  if (params.subCategoryId) query.subCategoryId = params.subCategoryId;
  if (params.productId) query.productId = params.productId;
  if (params.search) query.search = params.search;
  return get<AdminContentPostListItem[]>(`${prefix}/content/posts`, query);
}

export async function fetchContentPost(id: string) {
  return get<AdminContentPostDetailResponse>(`${prefix}/content/posts/${id}`);
}

export async function createContentPost(body: {
  userId: string;
  type: string;
  title: string;
  body: string;
  mainCategoryId?: string | null;
  subCategoryId?: string | null;
  categoryId?: string | null;
  productId?: string | null;
  productGroupId?: string | null;
  eventId?: string | null;
}) {
  return post<AdminContentPostDetailResponse>(`${prefix}/content/posts`, body);
}

export async function updateContentPost(
  id: string,
  body: Partial<{
    title: string;
    body: string;
    isBoosted: boolean;
    boostedUntil: string | null;
    mainCategoryId: string | null;
    subCategoryId: string | null;
    categoryId: string | null;
    productGroupId: string | null;
    productId: string | null;
  }>
) {
  return patch<AdminContentPostListItem>(`${prefix}/content/posts/${id}`, body);
}

export async function deleteContentPost(id: string) {
  return del<{ id: string }>(`${prefix}/content/posts/${id}`);
}

export async function fetchContentCommentsStats() {
  return get<AdminContentCommentStatsResponse>(`${prefix}/content/comments/stats`);
}

export async function fetchContentComments(params: {
  limit?: number;
  offset?: number;
  postId?: string;
  userId?: string;
  parentIdNull?: boolean;
  sort?: 'createdAt' | 'likesCount';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  if (params.postId) query.postId = params.postId;
  if (params.userId) query.userId = params.userId;
  if (params.parentIdNull !== undefined) query.parentIdNull = params.parentIdNull;
  return get<AdminContentCommentListItem[]>(`${prefix}/content/comments`, query);
}

export async function fetchContentComment(id: string) {
  return get<AdminContentCommentDetailResponse>(`${prefix}/content/comments/${id}`);
}

export async function updateContentComment(id: string, body: { comment?: string }) {
  return patch<AdminContentCommentListItem>(`${prefix}/content/comments/${id}`, body);
}

export async function deleteContentComment(id: string) {
  return del<{ id: string }>(`${prefix}/content/comments/${id}`);
}

export async function fetchFeedHighlights(params?: {
  limit?: number;
  offset?: number;
  postId?: string;
  reason?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'highlightedAt',
    order: params?.order ?? 'desc',
  };
  if (params?.postId) query.postId = params.postId;
  if (params?.reason) query.reason = params.reason;
  return get<AdminFeedHighlightListItem[]>(`${prefix}/content/feed-highlights`, query);
}

export async function createFeedHighlight(body: { postId: string; reason: string }) {
  return post<AdminFeedHighlightListItem>(`${prefix}/content/feed-highlights`, body);
}

export async function updateFeedHighlight(id: string, body: { reason?: string }) {
  return patch<AdminFeedHighlightListItem>(`${prefix}/content/feed-highlights/${id}`, body);
}

export async function deleteFeedHighlight(id: string) {
  return del<unknown>(`${prefix}/content/feed-highlights/${id}`);
}

export async function fetchTrending(params?: {
  limit?: number;
  offset?: number;
  trendPeriod?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'score',
    order: params?.order ?? 'desc',
  };
  if (params?.trendPeriod) query.trendPeriod = params.trendPeriod;
  return get<AdminTrendingPostListItem[]>(`${prefix}/content/trending`, query);
}

export async function createTrending(body: { postId: string; trendPeriod: string; score?: number }) {
  return post<AdminTrendingPostListItem>(`${prefix}/content/trending`, body);
}

export async function updateTrending(id: string, body: { score?: number; trendPeriod?: string }) {
  return patch<AdminTrendingPostListItem>(`${prefix}/content/trending/${id}`, body);
}

export async function deleteTrending(id: string) {
  return del<unknown>(`${prefix}/content/trending/${id}`);
}

export async function fetchTopCommunityChoices(params?: {
  limit?: number;
  offset?: number;
  postId?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'awardedAt',
    order: params?.order ?? 'desc',
  };
  if (params?.postId) query.postId = params.postId;
  return get<AdminTopCommunityChoiceListItem[]>(`${prefix}/content/top-community-choices`, query);
}

export async function createTopCommunityChoice(body: {
  postId: string;
  reason?: string | null;
  badgeLabel: string;
}) {
  return post<AdminTopCommunityChoiceListItem>(`${prefix}/content/top-community-choices`, body);
}

export async function updateTopCommunityChoice(
  id: string,
  body: { reason?: string | null; badgeLabel?: string }
) {
  return patch<AdminTopCommunityChoiceListItem>(
    `${prefix}/content/top-community-choices/${id}`,
    body
  );
}

export async function deleteTopCommunityChoice(id: string) {
  return del<unknown>(`${prefix}/content/top-community-choices/${id}`);
}

export async function fetchManualReviewFlags(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  contentType?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'createdAt',
    order: params?.order ?? 'desc',
  };
  if (params?.status) query.status = params.status;
  if (params?.contentType) query.contentType = params.contentType;
  return get<AdminManualReviewFlagListItem[]>(`${prefix}/content/manual-review-flags`, query);
}

export async function fetchManualReviewFlag(id: string) {
  return get<AdminManualReviewFlagListItem & { contentSummary?: string }>(
    `${prefix}/content/manual-review-flags/${id}`
  );
}

export async function updateManualReviewFlag(id: string, body: { status?: string }) {
  return patch<AdminManualReviewFlagListItem>(
    `${prefix}/content/manual-review-flags/${id}`,
    body
  );
}

export async function fetchModerationActions(params?: {
  limit?: number;
  offset?: number;
  targetUserId?: string;
  contentType?: string;
  actionType?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'createdAt',
    order: params?.order ?? 'desc',
  };
  if (params?.targetUserId) query.targetUserId = params.targetUserId;
  if (params?.contentType) query.contentType = params.contentType;
  if (params?.actionType) query.actionType = params.actionType;
  return get<AdminModerationActionListItem[]>(`${prefix}/content/moderation-actions`, query);
}

export async function fetchModerationAction(id: string) {
  return get<AdminModerationActionListItem & { updatedAt?: string; contentSummary?: string }>(
    `${prefix}/content/moderation-actions/${id}`
  );
}

export async function fetchContentTags(params?: {
  limit?: number;
  offset?: number;
  postId?: string;
  search?: string;
}) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 50,
    offset: params?.offset ?? 0,
  };
  if (params?.postId) query.postId = params.postId;
  if (params?.search) query.search = params.search;
  return get<AdminContentTagListItem[]>(`${prefix}/content/tags`, query);
}

export async function createTag(body: { tag: string }) {
  return post<AdminContentTagListItem>(`${prefix}/content/tags`, body);
}

export async function updateTag(oldTag: string, newTag: string) {
  return patch<{ updated: number }>(`${prefix}/content/tags/${encodeURIComponent(oldTag)}`, {
    newTag,
  });
}

export async function deleteTag(tag: string) {
  return del<{ deleted: boolean }>(`${prefix}/content/tags/${encodeURIComponent(tag)}`);
}

export async function mergeTags(body: { sourceTags: string[]; targetTag: string }) {
  return post<{ merged: number }>(`${prefix}/content/tags/merge`, body);
}

export async function fetchUserPosts(
  userId: string,
  params?: {
    limit?: number;
    offset?: number;
    type?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }
) {
  const query: Record<string, string | number | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'createdAt',
    order: params?.order ?? 'desc',
  };
  if (params?.type) query.type = params.type;
  return get<AdminContentPostListItem[]>(`${prefix}/users/${userId}/posts`, query);
}

// ==================== Additional Stats Functions ====================

export interface FeedHighlightsStatsResponse {
  total: number;
  active: number;
}

export interface TrendingPostsStatsResponse {
  total: number;
  thisWeek: number;
}

export interface TagsCategoriesStatsResponse {
  totalTags: number;
  totalCategories: number;
}

export async function fetchFeedHighlightsStats() {
  return get<FeedHighlightsStatsResponse>(`${prefix}/content/feed-highlights/stats`);
}

export async function fetchTrendingPostsStats() {
  return get<TrendingPostsStatsResponse>(`${prefix}/content/trending/stats`);
}

export async function fetchTagsCategoriesStats() {
  return get<TagsCategoriesStatsResponse>(`${prefix}/content/tags-categories/stats`);
}
