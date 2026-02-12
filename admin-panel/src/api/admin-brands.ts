import { get, post, patch, del } from './client';
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

export type CreateBrandSurveyInput = {
  brandId: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  questions: {
    questionText: string;
    type: string;
  }[];
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

/* ========== Brand Leaderboards ========== */

export type AdminBrandLeaderboardStatsResponse = {
  total: number;
  active: number;
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
  id: string
): Promise<ApiResponse<AdminBrandSurveyResponsesResponse>> {
  return get<AdminBrandSurveyResponsesResponse>(`/admin/brands/surveys/${id}/responses`);
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

/* ========== Bridge Program ========== */

export async function fetchBridgeProgramStats(): Promise<
  ApiResponse<AdminBridgeProgramStatsResponse>
> {
  return get<AdminBridgeProgramStatsResponse>('/admin/brands/bridge-program/stats');
}

/* ========== Brand Leaderboards ========== */

export async function fetchBrandLeaderboardStats(): Promise<
  ApiResponse<AdminBrandLeaderboardStatsResponse>
> {
  return get<AdminBrandLeaderboardStatsResponse>('/admin/brands/leaderboards/stats');
}
