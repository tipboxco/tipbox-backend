import { get, post, patch, del, postFormData } from './client';
import type { ApiResponse } from './client';

// ==================== Type Interfaces ====================

/* ========== Brands ========== */

export type AdminBrandStatsResponse = {
  total: number;
  totalFollowers: number;
  activeSurveys: number;
  mostPopular: {
    brandId: string;
    brandName: string;
    followerCount: number;
  }[];
};

export type AdminBrandListItem = {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  category: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isPopular: boolean | null;
  rank: number | null;
  followerCount: number;
  postCount: number;
  createdAt: string;
};

export type AdminBrandDetailResponse = AdminBrandListItem & {
  updatedAt: string;
  imageUrl: string | null;
  bannerUrl: string | null;
  externalId: string | null;
  tags: unknown;
  recentFollowers: {
    userId: string;
    username: string | null;
    followedAt: string;
  }[];
  recentPosts: {
    id: string;
    userId: string;
    username: string | null;
    createdAt: string;
  }[];
};

export type CreateBrandInput = {
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  categoryId?: string | null;
  category?: string | null;
  isPopular?: boolean;
  rank?: number | null;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  externalId?: string | null;
  tags?: unknown;
};

export type UpdateBrandInput = Partial<Omit<CreateBrandInput, 'id'>>;

export type AdminBrandImageListItem = {
  id: string;
  imageUrl: string | null;
  caption: string | null;
  createdAt?: string;
};

export type UploadBrandImageInput = {
  imageUrl: string;
  caption?: string | null;
};

/* ========== Brand Categories ========== */

export type AdminBrandCategoryListItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  brandCount: number;
  createdAt: string;
};

export type AdminBrandCategoryDetailResponse = AdminBrandCategoryListItem & {
  updatedAt: string;
};

export type AdminBrandCategoryBrandItem = {
  id: string;
  name: string;
  logoUrl: string | null;
  isPopular: boolean | null;
  createdAt: string;
};

export type CreateBrandCategoryInput = {
  name: string;
  imageUrl?: string | null;
  categoryId?: string | null;
};

export type UpdateBrandCategoryInput = Partial<CreateBrandCategoryInput>;

/* ========== Brand Surveys ========== */

export type AdminBrandSurveyStatsResponse = {
  total: number;
  active: number;
  totalResponses: number;
  avgResponseRate: number;
  endingSoon: {
    surveyId: string;
    title: string;
    brandName: string;
    endsAt: string;
  }[];
};

export type AdminBrandSurveyListItem = {
  id: string;
  brandId: string;
  brandName: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  status: string; // ACTIVE | UPCOMING | ENDED
  questionCount: number;
  responseCount: number;
  createdAt: string;
};

export type AdminBrandSurveyDetailResponse = AdminBrandSurveyListItem & {
  updatedAt: string;
  questions: {
    id: string;
    questionText: string;
    type: string;
    options: Array<{ id: string; text: string }> | null;
    answerCount: number;
  }[];
};

export type AdminBrandSurveyResponsesResponse = {
  surveyId: string;
  surveyTitle: string;
  totalResponses: number;
  questions: {
    id: string;
    questionText: string;
    type: string;
    answers: {
      id: string;
      userId: string;
      username: string | null;
      answerText: string;
      createdAt: string;
    }[];
  }[];
};

export type AdminBrandSurveyResponseListItem = {
  id: string;
  userId: string;
  username: string | null;
  userEmail: string | null;
  answers: Record<string, string>;
  createdAt: string;
};

export type CreateBrandSurveyInput = {
  brandId: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  questions: {
    questionText: string;
    type: string;
    options?: Array<{ id: string; text: string }> | null;
  }[];
};

export type AddSurveyQuestionInput = {
  questionText: string;
  type: string;
  options?: Array<{ id: string; text: string }> | null;
};

export type UpdateBrandSurveyInput = {
  title?: string;
  description?: string | null;
  startsAt?: string;
  endsAt?: string;
};

/* ========== Bridge Program ========== */

export type AdminBridgeProgramStatsResponse = {
  totalFollowers: number;
  totalPosts: number;
  activeBrands: number;
};

export type AdminBridgeStatsResponse = AdminBridgeProgramStatsResponse & {
  avgFollowersPerBrand?: number;
};

export type AdminBridgePostListItem = {
  id: string;
  brandName?: string | null;
  username?: string | null;
  userEmail?: string | null;
  title?: string | null;
  followerOnly?: boolean;
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;
  createdAt?: string;
};

export type BridgePostsQueryParams = {
  limit?: number;
  offset?: number;
  search?: string;
};

/* ========== Brand Leaderboards ========== */

export type AdminBrandLeaderboardStatsResponse = {
  total: number;
  active: number;
};

export type AdminBrandLeaderboardListItem = {
  brandId: string;
  brandName: string;
  userId: string;
  username: string | null;
  userEmail: string | null;
  rank: number;
  score: number;
  period: string;
  createdAt: string;
};

/* ========== Brand Rewards ========== */

export type AdminBrandRewardHistoryListItem = {
  id: string;
  userId: string;
  username: string | null;
  userEmail: string | null;
  badgeId: string;
  badgeName: string;
  reason: string | null;
  awardedBy: string | null;
  awardedByEmail: string | null;
  awardedAt: string;
};

export type AwardBrandBadgeInput = {
  brandId: string;
  userId: string;
  badgeId: string;
  reason: string;
};

/* ========== Query Parameters ========== */

export type BrandsQueryParams = {
  limit?: number;
  offset?: number;
  search?: string;
  categoryId?: string;
  isPopular?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type BrandCategoriesQueryParams = {
  search?: string;
};

export type BrandSurveysQueryParams = {
  limit?: number;
  offset?: number;
  brandId?: string;
  status?: 'ACTIVE' | 'UPCOMING' | 'ENDED';
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type BrandSurveyResponsesQueryParams = {
  limit?: number;
  offset?: number;
};

export type BrandLeaderboardsQueryParams = {
  brandId: string;
  period?: 'WEEKLY' | 'MONTHLY';
};

export type BrandRewardHistoryQueryParams = {
  limit?: number;
  offset?: number;
};

// ==================== API Functions ====================

/* ========== Brands ========== */

export async function fetchBrandStats(): Promise<ApiResponse<AdminBrandStatsResponse>> {
  return get<AdminBrandStatsResponse>('/admin/brands/stats');
}

export async function fetchBrands(
  params: BrandsQueryParams = {}
): Promise<ApiResponse<AdminBrandListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    search: params.search,
    categoryId: params.categoryId,
    isPopular: params.isPopular,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminBrandListItem[]>('/admin/brands', query);
}

export async function fetchBrand(id: string): Promise<ApiResponse<AdminBrandDetailResponse>> {
  return get<AdminBrandDetailResponse>(`/admin/brands/${id}`);
}

export async function createBrand(
  data: CreateBrandInput
): Promise<ApiResponse<AdminBrandDetailResponse>> {
  return post<AdminBrandDetailResponse>('/admin/brands', data);
}

export async function updateBrand(
  id: string,
  data: UpdateBrandInput
): Promise<ApiResponse<AdminBrandDetailResponse>> {
  return patch<AdminBrandDetailResponse>(`/admin/brands/${id}`, data);
}

export async function deleteBrand(id: string): Promise<ApiResponse<void>> {
  return del<void>(`/admin/brands/${id}`);
}

export async function uploadBrandLogo(file: File): Promise<ApiResponse<{ url: string }>> {
  const formData = new FormData();
  formData.append('file', file);
  return postFormData<{ url: string }>('/admin/brands/upload-logo', formData);
}

export async function uploadBrandBanner(file: File): Promise<ApiResponse<{ url: string }>> {
  const formData = new FormData();
  formData.append('file', file);
  return postFormData<{ url: string }>('/admin/brands/upload-banner', formData);
}

export async function fetchBrandImages(
  brandId: string
): Promise<ApiResponse<AdminBrandImageListItem[]>> {
  return get<AdminBrandImageListItem[]>(`/admin/brands/${brandId}/images`);
}

export async function uploadBrandImage(
  brandId: string,
  data: UploadBrandImageInput
): Promise<ApiResponse<AdminBrandImageListItem>> {
  return post<AdminBrandImageListItem>(`/admin/brands/${brandId}/images`, data);
}

export async function deleteBrandImage(
  brandId: string,
  imageId: string
): Promise<ApiResponse<void>> {
  return del<void>(`/admin/brands/${brandId}/images/${imageId}`);
}

/* ========== Brand Categories ========== */

export async function fetchBrandCategories(
  params: BrandCategoriesQueryParams = {}
): Promise<ApiResponse<AdminBrandCategoryListItem[]>> {
  const query = {
    search: params.search,
  };
  return get<AdminBrandCategoryListItem[]>('/admin/brands/categories', query);
}

export async function createBrandCategory(
  data: CreateBrandCategoryInput
): Promise<ApiResponse<AdminBrandCategoryDetailResponse>> {
  return post<AdminBrandCategoryDetailResponse>('/admin/brands/categories', data);
}

export async function updateBrandCategory(
  id: string,
  data: UpdateBrandCategoryInput
): Promise<ApiResponse<AdminBrandCategoryDetailResponse>> {
  return patch<AdminBrandCategoryDetailResponse>(`/admin/brands/categories/${id}`, data);
}

export async function deleteBrandCategory(id: string): Promise<ApiResponse<void>> {
  return del<void>(`/admin/brands/categories/${id}`);
}

export async function fetchBrandCategoryBrands(
  categoryId: string,
  params?: { limit?: number; offset?: number; search?: string }
): Promise<ApiResponse<AdminBrandCategoryBrandItem[]>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  return get<AdminBrandCategoryBrandItem[]>(
    `/admin/brands/categories/${categoryId}/brands${qs ? `?${qs}` : ''}`
  );
}

/* ========== Brand Surveys ========== */

export async function fetchBrandSurveyStats(): Promise<
  ApiResponse<AdminBrandSurveyStatsResponse>
> {
  return get<AdminBrandSurveyStatsResponse>('/admin/brands/surveys/stats');
}

export async function fetchBrandSurveys(
  params: BrandSurveysQueryParams = {}
): Promise<ApiResponse<AdminBrandSurveyListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    brandId: params.brandId,
    status: params.status,
    search: params.search,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminBrandSurveyListItem[]>('/admin/brands/surveys', query);
}

export async function fetchBrandSurvey(
  id: string
): Promise<ApiResponse<AdminBrandSurveyDetailResponse>> {
  return get<AdminBrandSurveyDetailResponse>(`/admin/brands/surveys/${id}`);
}

export async function fetchBrandSurveyResponses(
  id: string,
  params: BrandSurveyResponsesQueryParams = {}
): Promise<ApiResponse<AdminBrandSurveyResponsesResponse>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
  };
  return get<AdminBrandSurveyResponsesResponse>(`/admin/brands/surveys/${id}/responses`, query);
}

export async function createBrandSurvey(
  data: CreateBrandSurveyInput
): Promise<ApiResponse<AdminBrandSurveyDetailResponse>> {
  return post<AdminBrandSurveyDetailResponse>('/admin/brands/surveys', data);
}

export async function updateBrandSurvey(
  id: string,
  data: UpdateBrandSurveyInput
): Promise<ApiResponse<AdminBrandSurveyDetailResponse>> {
  return patch<AdminBrandSurveyDetailResponse>(`/admin/brands/surveys/${id}`, data);
}

export async function deleteBrandSurvey(id: string): Promise<ApiResponse<void>> {
  return del<void>(`/admin/brands/surveys/${id}`);
}

export async function closeBrandSurvey(id: string): Promise<ApiResponse<void>> {
  return patch<void>(`/admin/brands/surveys/${id}/close`, {});
}

export async function addSurveyQuestion(
  surveyId: string,
  data: AddSurveyQuestionInput
): Promise<ApiResponse<{ id: string; questionText: string; type: string; options: Array<{ id: string; text: string }> | null }>> {
  return post<{ id: string; questionText: string; type: string; options: Array<{ id: string; text: string }> | null }>(
    `/admin/brands/surveys/${surveyId}/questions`,
    data
  );
}

export async function deleteSurveyQuestion(
  surveyId: string,
  questionId: string
): Promise<ApiResponse<void>> {
  return del<void>(`/admin/brands/surveys/${surveyId}/questions/${questionId}`);
}

/* ========== Bridge Program ========== */

export async function fetchBridgeProgramStats(): Promise<
  ApiResponse<AdminBridgeProgramStatsResponse>
> {
  return get<AdminBridgeProgramStatsResponse>('/admin/brands/bridge-program/stats');
}

export async function fetchBridgeStats(): Promise<ApiResponse<AdminBridgeStatsResponse>> {
  return get<AdminBridgeStatsResponse>('/admin/brands/bridge-program/stats');
}

export async function fetchBridgePosts(
  params: BridgePostsQueryParams = {}
): Promise<ApiResponse<AdminBridgePostListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    search: params.search,
  };
  return get<AdminBridgePostListItem[]>('/admin/brands/bridge-program/posts', query);
}

/* ========== Brand Leaderboards ========== */

export async function fetchBrandLeaderboardStats(): Promise<
  ApiResponse<AdminBrandLeaderboardStatsResponse>
> {
  return get<AdminBrandLeaderboardStatsResponse>('/admin/brands/leaderboards/stats');
}

export async function fetchBrandLeaderboards(
  params: BrandLeaderboardsQueryParams
): Promise<ApiResponse<AdminBrandLeaderboardListItem[]>> {
  const query = {
    brandId: params.brandId,
    period: params.period ?? 'WEEKLY',
  };
  return get<AdminBrandLeaderboardListItem[]>('/admin/brands/leaderboards', query);
}

export async function recalculateBrandLeaderboard(
  brandId: string,
  period: 'WEEKLY' | 'MONTHLY'
): Promise<ApiResponse<void>> {
  return post<void>('/admin/brands/leaderboards/recalculate', { brandId, period });
}

/* ========== Brand Rewards ========== */

export async function fetchBrandRewardHistory(
  brandId: string,
  params: BrandRewardHistoryQueryParams = {}
): Promise<ApiResponse<AdminBrandRewardHistoryListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
  };
  return get<AdminBrandRewardHistoryListItem[]>(`/admin/brands/${brandId}/rewards`, query);
}

export async function awardBrandBadge(
  data: AwardBrandBadgeInput
): Promise<ApiResponse<void>> {
  return post<void>('/admin/brands/rewards/award', data);
}
