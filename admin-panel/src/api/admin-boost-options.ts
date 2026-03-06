import { get, post, patch, del, postFormData } from './client';

const prefix = '/admin';

export interface BoostOptionStatsResponse {
  total: number;
  active: number;
  inactive: number;
  popular: number;
}

export interface BoostOptionListItem {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  amount: number;
  isPopular: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchBoostOptionStats() {
  return get<BoostOptionStatsResponse>(`${prefix}/boost-options/stats`);
}

export async function fetchBoostOptions(params?: {
  limit?: number;
  offset?: number;
  isActive?: boolean;
  search?: string;
  sort?: 'createdAt' | 'amount' | 'title';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    limit: params?.limit ?? 50,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'amount',
    order: params?.order ?? 'asc',
  };
  if (params?.isActive !== undefined) query.isActive = params.isActive;
  if (params?.search) query.search = params.search;
  return get<BoostOptionListItem[]>(`${prefix}/boost-options`, query);
}

export async function fetchBoostOption(id: string) {
  return get<BoostOptionListItem>(`${prefix}/boost-options/${id}`);
}

export async function uploadBoostOptionImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return postFormData<{ success: boolean; url: string }>(`${prefix}/boost-options/upload-image`, formData);
}

export async function createBoostOption(body: {
  title: string;
  description?: string | null;
  image?: string | null;
  amount: number;
  isPopular?: boolean;
  isActive?: boolean;
}) {
  return post<BoostOptionListItem>(`${prefix}/boost-options`, body);
}

export async function updateBoostOption(id: string, body: {
  title?: string;
  description?: string | null;
  image?: string | null;
  amount?: number;
  isPopular?: boolean;
  isActive?: boolean;
}) {
  return patch<BoostOptionListItem>(`${prefix}/boost-options/${id}`, body);
}

export async function deleteBoostOption(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/boost-options/${id}`);
}
