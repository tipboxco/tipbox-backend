import { get, post, patch, del } from './client';

const prefix = '/admin';

export interface ComparisonMetricListItem {
  id: string;
  name: string;
  description: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function fetchComparisonMetrics(params?: {
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
  return get<ComparisonMetricListItem[]>(`${prefix}/comparison-metrics`, query);
}

export async function fetchComparisonMetric(id: string) {
  return get<ComparisonMetricListItem>(`${prefix}/comparison-metrics/${id}`);
}

export async function createComparisonMetric(body: { name: string; description?: string | null }) {
  return post<ComparisonMetricListItem>(`${prefix}/comparison-metrics`, body);
}

export async function updateComparisonMetric(id: string, body: { name?: string; description?: string | null }) {
  return patch<ComparisonMetricListItem>(`${prefix}/comparison-metrics/${id}`, body);
}

export async function deleteComparisonMetric(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/comparison-metrics/${id}`);
}
