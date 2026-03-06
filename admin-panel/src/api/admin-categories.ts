import { get, post, patch, del, postFormData } from './client';

const prefix = '/admin';

// ==================== Types ====================

export interface CategoryStatsResponse {
  mainCategories: number;
  subCategories: number;
  total: number;
  mainWithImage: number;
  subWithImage: number;
}

export interface MainCategoryListItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  subCategoriesCount: number;
  contentPostsCount: number;
  eventsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MainCategoryDetail extends MainCategoryListItem {
  subCategories: SubCategoryListItem[];
}

export interface SubCategoryListItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  mainCategoryId: string;
  mainCategoryName: string;
  contentPostsCount: number;
  productGroupsCount: number;
  eventsCount: number;
  createdAt: string;
  updatedAt: string;
}

// ==================== Stats ====================

export async function fetchCategoryStats() {
  return get<CategoryStatsResponse>(`${prefix}/categories/stats`);
}

// ==================== Main Categories ====================

export async function fetchMainCategories(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: 'createdAt' | 'name';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    limit: params?.limit ?? 50,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'name',
    order: params?.order ?? 'asc',
  };
  if (params?.search) query.search = params.search;
  return get<MainCategoryListItem[]>(`${prefix}/categories/main`, query);
}

export async function fetchMainCategory(id: string) {
  return get<MainCategoryDetail>(`${prefix}/categories/main/${id}`);
}

export async function uploadMainCategoryImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return postFormData<{ success: boolean; url: string }>(`${prefix}/categories/main/upload-image`, formData);
}

export async function createMainCategory(body: {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
}) {
  return post<MainCategoryListItem>(`${prefix}/categories/main`, body);
}

export async function updateMainCategory(id: string, body: {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
}) {
  return patch<MainCategoryListItem>(`${prefix}/categories/main/${id}`, body);
}

export async function deleteMainCategory(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/categories/main/${id}`);
}

// ==================== Sub Categories ====================

export async function fetchSubCategories(params?: {
  limit?: number;
  offset?: number;
  mainCategoryId?: string;
  search?: string;
  sort?: 'createdAt' | 'name';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    limit: params?.limit ?? 50,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'name',
    order: params?.order ?? 'asc',
  };
  if (params?.mainCategoryId) query.mainCategoryId = params.mainCategoryId;
  if (params?.search) query.search = params.search;
  return get<SubCategoryListItem[]>(`${prefix}/categories/sub`, query);
}

export async function fetchSubCategory(id: string) {
  return get<SubCategoryListItem>(`${prefix}/categories/sub/${id}`);
}

export async function uploadSubCategoryImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return postFormData<{ success: boolean; url: string }>(`${prefix}/categories/sub/upload-image`, formData);
}

export async function createSubCategory(body: {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  mainCategoryId: string;
}) {
  return post<SubCategoryListItem>(`${prefix}/categories/sub`, body);
}

export async function updateSubCategory(id: string, body: {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  mainCategoryId?: string;
}) {
  return patch<SubCategoryListItem>(`${prefix}/categories/sub/${id}`, body);
}

export async function deleteSubCategory(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/categories/sub/${id}`);
}
