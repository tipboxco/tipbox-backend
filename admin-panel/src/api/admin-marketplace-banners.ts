import { get, post, patch, del, postFormData } from './client';

const prefix = '/admin';

export interface MarketplaceBannerStatsResponse {
  total: number;
  active: number;
  inactive: number;
  scheduled: number;
  expired: number;
  currentlyShowing: number;
}

export interface MarketplaceBannerListItem {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  linkUrl: string | null;
  isActive: boolean;
  displayOrder: number;
  startDate: string | null;
  endDate: string | null;
  status: 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceBannerDetail {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  linkUrl: string | null;
  isActive: boolean;
  displayOrder: number;
  startDate: string | null;
  endDate: string | null;
  status: 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export async function fetchMarketplaceBannersStats() {
  return get<MarketplaceBannerStatsResponse>(`${prefix}/marketplace-banners/stats`);
}

export async function fetchMarketplaceBanners(params?: {
  limit?: number;
  offset?: number;
  isActive?: boolean;
  search?: string;
  sort?: 'createdAt' | 'displayOrder' | 'startDate';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'displayOrder',
    order: params?.order ?? 'asc',
  };
  if (params?.isActive !== undefined) query.isActive = params.isActive;
  if (params?.search) query.search = params.search;
  return get<MarketplaceBannerListItem[]>(`${prefix}/marketplace-banners`, query);
}

export async function fetchMarketplaceBanner(id: string) {
  return get<MarketplaceBannerDetail>(`${prefix}/marketplace-banners/${id}`);
}

export async function uploadBannerImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return postFormData<{ success: boolean; url: string }>(
    `${prefix}/marketplace-banners/upload-image`,
    formData
  );
}

export async function createMarketplaceBanner(body: {
  title: string;
  description?: string | null;
  imageUrl: string;
  linkUrl?: string | null;
  isActive?: boolean;
  displayOrder?: number;
  startDate?: string | null;
  endDate?: string | null;
}) {
  return post<{
    id: string;
    title: string;
    description: string | null;
    imageUrl: string;
    linkUrl: string | null;
    isActive: boolean;
    displayOrder: number;
    startDate: string | null;
    endDate: string | null;
    createdAt: string;
  }>(`${prefix}/marketplace-banners`, body);
}

export async function updateMarketplaceBanner(
  id: string,
  body: {
    title?: string;
    description?: string | null;
    imageUrl?: string;
    linkUrl?: string | null;
    isActive?: boolean;
    displayOrder?: number;
    startDate?: string | null;
    endDate?: string | null;
  }
) {
  return patch<{
    id: string;
    title: string;
    description: string | null;
    imageUrl: string;
    linkUrl: string | null;
    isActive: boolean;
    displayOrder: number;
    startDate: string | null;
    endDate: string | null;
    updatedAt: string;
  }>(`${prefix}/marketplace-banners/${id}`, body);
}

export async function deleteMarketplaceBanner(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/marketplace-banners/${id}`);
}
