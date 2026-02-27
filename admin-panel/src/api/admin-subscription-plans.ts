import { get, post, patch, del } from './client';

const prefix = '/admin';

export interface SubscriptionPlanStatsResponse {
  total: number;
  active: number;
  inactive: number;
  byPeriod: Record<string, number>;
  totalSubscriptions: number;
}

export interface SubscriptionPlanListItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: 'MONTHLY' | 'YEARLY';
  benefits: unknown;
  isActive: boolean;
  displayOrder: number;
  subscriptionCount: number;
  invoiceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlanDetail {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: 'MONTHLY' | 'YEARLY';
  benefits: unknown;
  isActive: boolean;
  displayOrder: number;
  subscriptionCount: number;
  invoiceCount: number;
  recentSubscriptions: Array<{
    id: string;
    userId: string;
    username: string | null;
    userEmail: string | null;
    status: string;
    startDate: string;
    endDate: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export async function fetchSubscriptionPlansStats() {
  return get<SubscriptionPlanStatsResponse>(`${prefix}/subscription-plans/stats`);
}

export async function fetchSubscriptionPlans(params?: {
  limit?: number;
  offset?: number;
  isActive?: boolean;
  period?: 'MONTHLY' | 'YEARLY';
  sort?: 'createdAt' | 'displayOrder' | 'price';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'displayOrder',
    order: params?.order ?? 'asc',
  };
  if (params?.isActive !== undefined) query.isActive = params.isActive;
  if (params?.period) query.period = params.period;
  return get<SubscriptionPlanListItem[]>(`${prefix}/subscription-plans`, query);
}

export async function fetchSubscriptionPlan(id: string) {
  return get<SubscriptionPlanDetail>(`${prefix}/subscription-plans/${id}`);
}

export async function createSubscriptionPlan(body: {
  name: string;
  price: number;
  currency?: string;
  period: 'MONTHLY' | 'YEARLY';
  benefits?: string[];
  isActive?: boolean;
  displayOrder?: number;
}) {
  return post<{
    id: string;
    name: string;
    price: number;
    currency: string;
    period: string;
    benefits: unknown;
    isActive: boolean;
    displayOrder: number;
    createdAt: string;
  }>(`${prefix}/subscription-plans`, body);
}

export async function updateSubscriptionPlan(
  id: string,
  body: {
    name?: string;
    price?: number;
    currency?: string;
    period?: 'MONTHLY' | 'YEARLY';
    benefits?: string[];
    isActive?: boolean;
    displayOrder?: number;
  }
) {
  return patch<{
    id: string;
    name: string;
    price: number;
    currency: string;
    period: string;
    benefits: unknown;
    isActive: boolean;
    displayOrder: number;
    updatedAt: string;
  }>(`${prefix}/subscription-plans/${id}`, body);
}

export async function deleteSubscriptionPlan(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/subscription-plans/${id}`);
}
