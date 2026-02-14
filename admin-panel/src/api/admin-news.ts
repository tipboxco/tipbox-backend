import { get, post, patch, del, postFormData } from './client';
import type { ApiResponse } from './client';
import type {
  AdminNewsStatsResponse,
  AdminNewsListItem,
  AdminNewsDetailResponse,
  AdminNewsCommentListItem,
  CreateNewsInput,
  UpdateNewsInput,
  NewsQueryParams,
} from '../types/admin-news';

const prefix = '/admin';

// ==================== News Stats ====================

export async function fetchNewsStats(): Promise<ApiResponse<AdminNewsStatsResponse>> {
  return get<AdminNewsStatsResponse>(`${prefix}/news/stats`);
}

// ==================== News CRUD ====================

export async function fetchNewsList(
  params: NewsQueryParams = {}
): Promise<ApiResponse<AdminNewsListItem[]>> {
  const query: Record<string, string | number | undefined> = {
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };

  if (params.brandId) query.brandId = params.brandId;
  if (params.source) query.source = params.source;
  if (params.search) query.search = params.search;
  if (params.dateFrom) query.dateFrom = params.dateFrom;
  if (params.dateTo) query.dateTo = params.dateTo;
  if (params.tags && params.tags.length > 0) {
    query.tags = params.tags.join(',');
  }

  return get<AdminNewsListItem[]>(`${prefix}/news`, query);
}

export async function fetchNewsDetail(id: string): Promise<ApiResponse<AdminNewsDetailResponse>> {
  return get<AdminNewsDetailResponse>(`${prefix}/news/${id}`);
}

export async function createNews(data: CreateNewsInput): Promise<ApiResponse<AdminNewsDetailResponse>> {
  return post<AdminNewsDetailResponse>(`${prefix}/news`, data);
}

export async function updateNews(
  id: string,
  data: UpdateNewsInput
): Promise<ApiResponse<AdminNewsDetailResponse>> {
  return patch<AdminNewsDetailResponse>(`${prefix}/news/${id}`, data);
}

export async function deleteNews(id: string): Promise<ApiResponse<{ message: string }>> {
  return del<{ message: string }>(`${prefix}/news/${id}`);
}

// ==================== News Image Upload ====================

export async function uploadNewsImage(file: File): Promise<ApiResponse<{ url: string }>> {
  const formData = new FormData();
  formData.append('file', file);
  return postFormData<{ url: string }>(`${prefix}/news/upload-image`, formData);
}

// ==================== News Comments ====================

export async function fetchNewsComments(
  newsId: string,
  params?: { limit?: number; offset?: number }
): Promise<ApiResponse<AdminNewsCommentListItem[]>> {
  const query = params
    ? {
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
      }
    : undefined;
  return get<AdminNewsCommentListItem[]>(`${prefix}/news/${newsId}/comments`, query);
}

export async function deleteNewsComment(commentId: string): Promise<ApiResponse<{ message: string }>> {
  return del<{ message: string }>(`${prefix}/news/comments/${commentId}`);
}
