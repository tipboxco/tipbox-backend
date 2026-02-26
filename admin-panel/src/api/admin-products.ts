import { get, post, patch, del, put, postFormData } from './client';
import type { ApiResponse } from './client';

// ==================== Type Interfaces ====================

/* ========== Products ========== */

export type AdminProductStatsResponse = {
  total: number;
  addedThisMonth: number;
  byCategory: Record<string, number>;
  byCategoryCount: number;
  topByInventory: {
    productId: string;
    productName: string;
    inventoryCount: number;
  }[];
};

export type AdminProductListItem = {
  id: string;
  name: string;
  subName: string | null;
  description: string | null;
  groupId: string | null;
  groupName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  brandId: string | null;
  imageUrl: string | null;
  thumbnail: string | null;
  inventoryCount: number;
  postCount: number;
  createdAt: string;
};

export type AdminProductDetailResponse = AdminProductListItem & {
  updatedAt: string;
  metadata: Record<string, unknown> | null;
  recentInventories: {
    userId: string;
    username: string | null;
    createdAt: string;
  }[];
  recentPosts: {
    id: string;
    userId: string;
    username: string | null;
    createdAt: string;
  }[];
};

export type CreateProductInput = {
  id: string;
  name: string;
  description?: string | null;
  subName?: string | null;
  groupId?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  imageUrl?: string | null;
  thumbnail?: string | null;
  metadata?: Record<string, unknown>;
};

export type UpdateProductInput = Partial<Omit<CreateProductInput, 'id'>>;

export type MergeProductsInput = {
  sourceProductId: string;
  targetProductId: string;
};

/* ========== Categories ========== */

export type AdminCategoryStatsResponse = {
  total: number;
  active: number;
  inactive: number;
};

export type AdminCategoryListItem = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  thumbnail: string | null;
  handle: string | null;
  rank: number | null;
  isActive: boolean | null;
  level: number | null;
  productCount: number;
  children: AdminCategoryListItem[];
};

export type AdminCategoryDetailResponse = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  thumbnail: string | null;
  handle: string | null;
  rank: number | null;
  isActive: boolean | null;
  metadata: Record<string, unknown> | null;
  productCount: number;
  children: AdminCategoryListItem[];
};

export type CreateCategoryInput = {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  thumbnail?: string | null;
  handle?: string | null;
  rank?: number | null;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
};

export type UpdateCategoryInput = Partial<Omit<CreateCategoryInput, 'id'>>;

export type ReorderCategoryInput = {
  rank: number;
};

/* ========== Product Groups ========== */

export type AdminProductGroupStatsResponse = {
  total: number;
  withProducts?: number;
  mostPopular?: {
    id: string;
    name: string;
    productCount: number;
  };
};

export type AdminProductGroupListItem = {
  id: string;
  name: string;
  description: string | null;
  subCategoryId: string;
  subCategoryName: string | null;
  imageUrl: string | null;
  productCount: number;
};

export type AdminProductGroupDetailResponse = AdminProductGroupListItem & {
  products: {
    id: string;
    name: string;
    imageUrl: string | null;
  }[];
};

export type CreateProductGroupInput = {
  id: string;
  name: string;
  description?: string | null;
  subCategoryId: string;
  imageUrl?: string | null;
};

export type UpdateProductGroupInput = Partial<Omit<CreateProductGroupInput, 'id'>>;

/* ========== Product Suggestions ========== */

export type AdminProductSuggestionStatsResponse = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  approvedThisMonth: number;
  thisWeek: number;
  topSuggesters: {
    userId: string;
    username: string | null;
    suggestionCount: number;
  }[];
};

export type AdminProductSuggestionListItem = {
  id: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  suggestedName: string;
  suggestedBrand: string | null;
  description: string | null;
  reason: string | null;
  status: string; // PENDING | APPROVED | REJECTED
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminProductSuggestionDetailResponse = AdminProductSuggestionListItem & {
  updatedAt: string;
  user: {
    id: string;
    email: string | null;
    username: string | null;
  };
};

export type ApproveSuggestionInput = {
  productId: string;
  productName: string;
  groupId?: string | null;
  brandId?: string | null;
};

export type RejectSuggestionInput = {
  reason: string;
};

/* ========== User Inventories ========== */

export type AdminInventoryStatsResponse = {
  total: number;
  uniqueUsers: number;
  uniqueProducts: number;
  avgDuration?: string;
};

export type AdminInventoryListItem = {
  id: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  productId: string;
  productName: string;
  categoryName?: string | null;
  experienceSummary: string | null;
  experienceType?: string | null;
  duration?: string | null;
  location?: string | null;
  isActive?: boolean;
  hasMedia: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminInventoryDetailResponse = AdminInventoryListItem & {
  purpose?: string | null;
  isLegacy?: boolean;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
  media?: {
    id: string;
    url: string;
    uploadedAt: string;
  }[];
  history?: {
    action: string;
    details?: string;
    timestamp: string;
  }[];
};

/* ========== Product Analytics ========== */

export type AdminProductAnalyticsResponse = {
  topProductsByPosts: {
    productId: string;
    productName: string;
    postCount: number;
  }[];
  topProductsByUsers: {
    productId: string;
    productName: string;
    userCount: number;
  }[];
  categoryDistribution: {
    categoryId: string;
    categoryName: string;
    productCount: number;
  }[];
};

/* ========== Product Comparisons ========== */

export type AdminProductComparisonStatsResponse = {
  total: number;
  thisMonth: number;
  thisWeek?: number;
  avgProductsCompared?: number;
  topCategory?: string;
};

export type AdminProductComparisonListItem = {
  id: string;
  title?: string | null;
  username?: string | null;
  userEmail?: string | null;
  productCount?: number;
  categoryName?: string | null;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  createdAt?: string;
};

export type AdminProductComparisonDetailResponse = AdminProductComparisonListItem & {
  body?: string;
  comparedProducts?: {
    id: string;
    name: string;
    score?: number | null;
    notes?: string | null;
  }[];
};

export type ComparisonsQueryParams = {
  limit?: number;
  offset?: number;
  search?: string;
};

/* ========== Query Parameters ========== */

export type ProductsQueryParams = {
  limit?: number;
  offset?: number;
  search?: string;
  categoryId?: string;
  groupId?: string;
  brandId?: string;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type CategoriesQueryParams = {
  parentId?: string;
  isActive?: boolean;
  search?: string;
};

export type ProductGroupsQueryParams = {
  limit?: number;
  offset?: number;
  search?: string;
  subCategoryId?: string;
};

export type ProductSuggestionsQueryParams = {
  limit?: number;
  offset?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  userId?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type InventoriesQueryParams = {
  limit?: number;
  offset?: number;
  userId?: string;
  productId?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
};

// ==================== API Functions ====================

/* ========== Products ========== */

export async function fetchProductStats(): Promise<ApiResponse<AdminProductStatsResponse>> {
  return get<AdminProductStatsResponse>('/admin/products/stats');
}

export async function fetchProducts(
  params: ProductsQueryParams = {}
): Promise<ApiResponse<AdminProductListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    search: params.search,
    categoryId: params.categoryId,
    groupId: params.groupId,
    brandId: params.brandId,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminProductListItem[]>('/admin/products', query);
}

export async function fetchProduct(id: string): Promise<ApiResponse<AdminProductDetailResponse>> {
  return get<AdminProductDetailResponse>(`/admin/products/${id}`);
}

export async function createProduct(
  data: CreateProductInput
): Promise<ApiResponse<AdminProductDetailResponse>> {
  return post<AdminProductDetailResponse>('/admin/products', data);
}

export async function uploadProductImage(file: File): Promise<ApiResponse<{ url: string }>> {
  const formData = new FormData();
  formData.append('file', file);
  return postFormData<{ url: string }>('/admin/products/upload-image', formData);
}

export async function updateProduct(
  id: string,
  data: UpdateProductInput
): Promise<ApiResponse<AdminProductDetailResponse>> {
  return patch<AdminProductDetailResponse>(`/admin/products/${id}`, data);
}

export async function deleteProduct(id: string): Promise<ApiResponse<void>> {
  return del<void>(`/admin/products/${id}`);
}

export async function mergeProducts(
  data: MergeProductsInput
): Promise<ApiResponse<{ message: string }>> {
  return post<{ message: string }>('/admin/products/merge', data);
}

export async function fetchProductAnalytics(): Promise<
  ApiResponse<AdminProductAnalyticsResponse>
> {
  return get<AdminProductAnalyticsResponse>('/admin/products/analytics');
}

/* ========== Categories ========== */

export async function fetchCategoryStats(): Promise<ApiResponse<AdminCategoryStatsResponse>> {
  return get<AdminCategoryStatsResponse>('/admin/products/categories/stats');
}

export async function fetchCategories(
  params: CategoriesQueryParams = {}
): Promise<ApiResponse<AdminCategoryListItem[]>> {
  const query = {
    parentId: params.parentId,
    isActive: params.isActive,
    search: params.search,
  };
  return get<AdminCategoryListItem[]>('/admin/products/categories', query);
}

export async function fetchCategory(
  id: string
): Promise<ApiResponse<AdminCategoryDetailResponse>> {
  return get<AdminCategoryDetailResponse>(`/admin/products/categories/${id}`);
}

export async function createCategory(
  data: CreateCategoryInput
): Promise<ApiResponse<AdminCategoryDetailResponse>> {
  return post<AdminCategoryDetailResponse>('/admin/products/categories', data);
}

export async function updateCategory(
  id: string,
  data: UpdateCategoryInput
): Promise<ApiResponse<AdminCategoryDetailResponse>> {
  return patch<AdminCategoryDetailResponse>(`/admin/products/categories/${id}`, data);
}

export async function deleteCategory(id: string): Promise<ApiResponse<void>> {
  return del<void>(`/admin/products/categories/${id}`);
}

export async function reorderCategory(
  id: string,
  data: ReorderCategoryInput
): Promise<ApiResponse<AdminCategoryDetailResponse>> {
  return put<AdminCategoryDetailResponse>(`/admin/products/categories/${id}/reorder`, data);
}

/* ========== Product Groups ========== */

export async function fetchProductGroupStats(): Promise<
  ApiResponse<AdminProductGroupStatsResponse>
> {
  return get<AdminProductGroupStatsResponse>('/admin/products/groups/stats');
}

export async function fetchProductGroups(
  params: ProductGroupsQueryParams = {}
): Promise<ApiResponse<AdminProductGroupListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    search: params.search,
    subCategoryId: params.subCategoryId,
  };
  return get<AdminProductGroupListItem[]>('/admin/products/groups', query);
}

export async function fetchProductGroup(
  id: string
): Promise<ApiResponse<AdminProductGroupDetailResponse>> {
  return get<AdminProductGroupDetailResponse>(`/admin/products/groups/${id}`);
}

export async function createProductGroup(
  data: CreateProductGroupInput
): Promise<ApiResponse<AdminProductGroupDetailResponse>> {
  return post<AdminProductGroupDetailResponse>('/admin/products/groups', data);
}

export async function updateProductGroup(
  id: string,
  data: UpdateProductGroupInput
): Promise<ApiResponse<AdminProductGroupDetailResponse>> {
  return patch<AdminProductGroupDetailResponse>(`/admin/products/groups/${id}`, data);
}

export async function deleteProductGroup(id: string): Promise<ApiResponse<void>> {
  return del<void>(`/admin/products/groups/${id}`);
}

/* ========== Product Suggestions ========== */

export async function fetchProductSuggestionStats(): Promise<
  ApiResponse<AdminProductSuggestionStatsResponse>
> {
  return get<AdminProductSuggestionStatsResponse>('/admin/products/suggestions/stats');
}

export async function fetchProductSuggestions(
  params: ProductSuggestionsQueryParams = {}
): Promise<ApiResponse<AdminProductSuggestionListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    status: params.status,
    userId: params.userId,
    search: params.search,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminProductSuggestionListItem[]>('/admin/products/suggestions', query);
}

export async function fetchProductSuggestion(
  id: string
): Promise<ApiResponse<AdminProductSuggestionDetailResponse>> {
  return get<AdminProductSuggestionDetailResponse>(`/admin/products/suggestions/${id}`);
}

export async function approveSuggestion(
  id: string,
  data: ApproveSuggestionInput
): Promise<ApiResponse<{ message: string; product: AdminProductDetailResponse }>> {
  return patch<{ message: string; product: AdminProductDetailResponse }>(
    `/admin/products/suggestions/${id}/approve`,
    data
  );
}

export async function rejectSuggestion(
  id: string,
  data: RejectSuggestionInput
): Promise<ApiResponse<{ message: string }>> {
  return patch<{ message: string }>(`/admin/products/suggestions/${id}/reject`, data);
}

/* ========== User Inventories ========== */

export async function fetchInventoryStats(): Promise<ApiResponse<AdminInventoryStatsResponse>> {
  return get<AdminInventoryStatsResponse>('/admin/products/inventories/stats');
}

export async function fetchInventories(
  params: InventoriesQueryParams = {}
): Promise<ApiResponse<AdminInventoryListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    userId: params.userId,
    productId: params.productId,
    search: params.search,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminInventoryListItem[]>('/admin/products/inventories', query);
}

export async function fetchInventory(
  id: string
): Promise<ApiResponse<AdminInventoryDetailResponse>> {
  return get<AdminInventoryDetailResponse>(`/admin/products/inventories/${id}`);
}

/* ========== Product Comparisons ========== */

export async function fetchProductComparisonStats(): Promise<
  ApiResponse<AdminProductComparisonStatsResponse>
> {
  return get<AdminProductComparisonStatsResponse>('/admin/products/comparisons/stats');
}

export async function fetchProductComparisons(
  params: ComparisonsQueryParams = {}
): Promise<ApiResponse<AdminProductComparisonListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    search: params.search,
  };
  return get<AdminProductComparisonListItem[]>('/admin/products/comparisons', query);
}

export async function fetchProductComparison(
  id: string
): Promise<ApiResponse<AdminProductComparisonDetailResponse>> {
  return get<AdminProductComparisonDetailResponse>(`/admin/products/comparisons/${id}`);
}
