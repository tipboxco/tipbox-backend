import { get, post, patch, del } from './client';

const prefix = '/admin';

export interface ExperienceConfigStatsResponse {
  durations: { total: number; active: number };
  locations: { total: number; active: number };
  purposes: { total: number; active: number };
}

export interface ExperienceConfigItem {
  id: string;
  name: string;
  isActive: boolean;
  contentPostsCount: number;
  inventoriesCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function fetchExperienceConfigStats() {
  return get<ExperienceConfigStatsResponse>(`${prefix}/experience-config/stats`);
}

// Durations
export async function fetchDurations(params?: {
  limit?: number; offset?: number; isActive?: boolean; search?: string;
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    limit: params?.limit ?? 50, offset: params?.offset ?? 0,
  };
  if (params?.isActive !== undefined) query.isActive = params.isActive;
  if (params?.search) query.search = params.search;
  return get<ExperienceConfigItem[]>(`${prefix}/experience-config/durations`, query);
}

export async function createDuration(body: { name: string; isActive?: boolean }) {
  return post<ExperienceConfigItem>(`${prefix}/experience-config/durations`, body);
}

export async function updateDuration(id: string, body: { name?: string; isActive?: boolean }) {
  return patch<ExperienceConfigItem>(`${prefix}/experience-config/durations/${id}`, body);
}

export async function deleteDuration(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/experience-config/durations/${id}`);
}

// Locations
export async function fetchLocations(params?: {
  limit?: number; offset?: number; isActive?: boolean; search?: string;
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    limit: params?.limit ?? 50, offset: params?.offset ?? 0,
  };
  if (params?.isActive !== undefined) query.isActive = params.isActive;
  if (params?.search) query.search = params.search;
  return get<ExperienceConfigItem[]>(`${prefix}/experience-config/locations`, query);
}

export async function createLocation(body: { name: string; isActive?: boolean }) {
  return post<ExperienceConfigItem>(`${prefix}/experience-config/locations`, body);
}

export async function updateLocation(id: string, body: { name?: string; isActive?: boolean }) {
  return patch<ExperienceConfigItem>(`${prefix}/experience-config/locations/${id}`, body);
}

export async function deleteLocation(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/experience-config/locations/${id}`);
}

// Purposes
export async function fetchPurposes(params?: {
  limit?: number; offset?: number; isActive?: boolean; search?: string;
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    limit: params?.limit ?? 50, offset: params?.offset ?? 0,
  };
  if (params?.isActive !== undefined) query.isActive = params.isActive;
  if (params?.search) query.search = params.search;
  return get<ExperienceConfigItem[]>(`${prefix}/experience-config/purposes`, query);
}

export async function createPurpose(body: { name: string; isActive?: boolean }) {
  return post<ExperienceConfigItem>(`${prefix}/experience-config/purposes`, body);
}

export async function updatePurpose(id: string, body: { name?: string; isActive?: boolean }) {
  return patch<ExperienceConfigItem>(`${prefix}/experience-config/purposes/${id}`, body);
}

export async function deletePurpose(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/experience-config/purposes/${id}`);
}
