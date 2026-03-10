import { get, post, patch, del } from './client';
import type { ApiResponse } from './client';

// ==================== Type Interfaces ====================

/* ========== Subscription Plans ========== */

export type AdminSubscriptionPlanStatsResponse = {
  total: number;
  active: number;
  inactive: number;
  totalSubscribers: number;
  revenueThisMonth: number;
  mostPopularPlanId: string | null;
};

export type AdminSubscriptionPlanListItem = {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string;
  benefits: string[];
  isActive: boolean;
  displayOrder: number;
  subscriberCount: number;
  revenueTotal: number;
  createdAt: string;
};

export type AdminSubscriptionPlanDetailResponse = AdminSubscriptionPlanListItem & {
  updatedAt: string;
  recentSubscribers: {
    userId: string;
    username: string | null;
    email: string | null;
    subscribedAt: string;
  }[];
};

export type CreateSubscriptionPlanInput = {
  name: string;
  price: number;
  currency?: string;
  period: 'MONTHLY' | 'YEARLY';
  benefits: string[];
  isActive?: boolean;
  displayOrder?: number;
};

export type UpdateSubscriptionPlanInput = Partial<CreateSubscriptionPlanInput>;

/* ========== User Subscriptions ========== */

export type AdminUserSubscriptionStatsResponse = {
  total: number;
  active: number;
  trialing: number;
  canceled: number;
  pastDue: number;
  revenueThisMonth: number;
  churnRate: number;
};

export type AdminUserSubscriptionListItem = {
  id: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  planId: string;
  planName: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  paymentMethodId: string | null;
  canceledAt: string | null;
  createdAt: string;
};

export type AdminUserSubscriptionDetailResponse = AdminUserSubscriptionListItem & {
  updatedAt: string;
  invoices: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    invoiceDate: string;
    paidAt: string | null;
  }[];
};

export type ExtendSubscriptionInput = {
  days: number;
  reason: string;
};

/* ========== Invoices ========== */

export type AdminInvoiceStatsResponse = {
  total: number;
  pending: number;
  paid: number;
  failed: number;
  totalRevenue: number;
  revenueThisMonth: number;
};

export type AdminInvoiceListItem = {
  id: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  subscriptionId: string | null;
  planId: string | null;
  planName: string | null;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  invoiceDate: string;
  paidAt: string | null;
  createdAt: string;
};

export type AdminInvoiceDetailResponse = AdminInvoiceListItem & {
  externalId: string | null;
  updatedAt: string;
  user: {
    id: string;
    email: string | null;
    username: string | null;
  };
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  } | null;
};

export type UpdateInvoiceStatusInput = {
  status: 'Pending' | 'Paid' | 'Failed';
  paidAt?: string;
};

/* ========== Wallet Transactions (for commerce) ========== */

export type AdminTransactionStatsResponse = {
  total: number;
  created: number;
  pending: number;
  confirmed: number;
  failed: number;
  totalVolume: number;
  volumeThisMonth: number;
  byActionType: Record<string, number>;
};

export type AdminTransactionListItem = {
  id: string;
  walletId: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  actionType: string;
  status: string;
  amount: number | null;
  fromAddress: string | null;
  toAddress: string | null;
  txHash: string | null;
  provider: string;
  errorMessage: string | null;
  createdAt: string;
  confirmedAt: string | null;
  failedAt: string | null;
};

export type AdminTransactionDetailResponse = AdminTransactionListItem & {
  metadata: Record<string, unknown> | null;
  wallet: {
    id: string;
    publicAddress: string;
    provider: string;
    balance: number;
  };
};

/* ========== Rewards ========== */

export type AdminRewardStatsResponse = {
  total: number;
  claimed: number;
  pending: number;
  byType: Record<string, number>;
  totalValue: number;
};

export type AdminRewardListItem = {
  id: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  type: string;
  amount: number | null;
  badgeId: string | null;
  badgeName: string | null;
  status: string;
  reason: string | null;
  claimedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type AdminRewardDetailResponse = AdminRewardListItem & {
  updatedAt: string;
  user: {
    id: string;
    email: string | null;
    username: string | null;
  };
};

export type CreateRewardInput = {
  userId: string;
  type: 'TIPS' | 'BADGE' | 'ACHIEVEMENT' | 'EVENT';
  amount?: number | null;
  badgeId?: string | null;
  reason?: string | null;
  expiresAt?: string | null;
};

/* ========== Query Parameters ========== */

export type SubscriptionPlansQueryParams = {
  isActive?: boolean;
};

export type UserSubscriptionsQueryParams = {
  limit?: number;
  offset?: number;
  userId?: string;
  planId?: string;
  status?: 'active' | 'trialing' | 'canceled' | 'past_due';
  sort?: string;
  order?: 'asc' | 'desc';
};

export type InvoicesQueryParams = {
  limit?: number;
  offset?: number;
  userId?: string;
  subscriptionId?: string;
  status?: 'Pending' | 'Paid' | 'Failed';
  minAmount?: number;
  maxAmount?: number;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type TransactionsQueryParams = {
  limit?: number;
  offset?: number;
  walletId?: string;
  userId?: string;
  actionType?: string;
  status?: string;
  minAmount?: number;
  maxAmount?: number;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type RewardsQueryParams = {
  limit?: number;
  offset?: number;
  userId?: string;
  type?: 'TIPS' | 'BADGE' | 'ACHIEVEMENT' | 'EVENT';
  status?: 'PENDING' | 'CLAIMED' | 'EXPIRED';
  sort?: string;
  order?: 'asc' | 'desc';
};

// ==================== API Functions ====================

/* ========== Subscription Plans ========== */

export async function fetchSubscriptionPlanStats(): Promise<
  ApiResponse<AdminSubscriptionPlanStatsResponse>
> {
  return get<AdminSubscriptionPlanStatsResponse>('/admin/payments/plans/stats');
}

export async function fetchSubscriptionPlans(
  params: SubscriptionPlansQueryParams = {}
): Promise<ApiResponse<AdminSubscriptionPlanListItem[]>> {
  const query = { isActive: params.isActive };
  return get<AdminSubscriptionPlanListItem[]>('/admin/payments/plans', query);
}

export async function fetchSubscriptionPlan(
  id: string
): Promise<ApiResponse<AdminSubscriptionPlanDetailResponse>> {
  return get<AdminSubscriptionPlanDetailResponse>(`/admin/payments/plans/${id}`);
}

export async function createSubscriptionPlan(
  data: CreateSubscriptionPlanInput
): Promise<ApiResponse<AdminSubscriptionPlanDetailResponse>> {
  return post<AdminSubscriptionPlanDetailResponse>('/admin/payments/plans', data);
}

export async function updateSubscriptionPlan(
  id: string,
  data: UpdateSubscriptionPlanInput
): Promise<ApiResponse<AdminSubscriptionPlanDetailResponse>> {
  return patch<AdminSubscriptionPlanDetailResponse>(`/admin/payments/plans/${id}`, data);
}

export async function deleteSubscriptionPlan(id: string): Promise<ApiResponse<void>> {
  return del<void>(`/admin/payments/plans/${id}`);
}

/* ========== User Subscriptions ========== */

export async function fetchUserSubscriptionStats(): Promise<
  ApiResponse<AdminUserSubscriptionStatsResponse>
> {
  return get<AdminUserSubscriptionStatsResponse>('/admin/payments/subscriptions/stats');
}

export async function fetchUserSubscriptions(
  params: UserSubscriptionsQueryParams = {}
): Promise<ApiResponse<AdminUserSubscriptionListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    userId: params.userId,
    planId: params.planId,
    status: params.status,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminUserSubscriptionListItem[]>('/admin/payments/subscriptions', query);
}

export async function fetchUserSubscription(
  id: string
): Promise<ApiResponse<AdminUserSubscriptionDetailResponse>> {
  return get<AdminUserSubscriptionDetailResponse>(`/admin/payments/subscriptions/${id}`);
}

export async function cancelUserSubscription(
  id: string,
  reason?: string
): Promise<ApiResponse<{ message: string }>> {
  return post<{ message: string }>(`/admin/payments/subscriptions/${id}/cancel`, { reason });
}

export async function extendUserSubscription(
  id: string,
  data: ExtendSubscriptionInput
): Promise<ApiResponse<AdminUserSubscriptionDetailResponse>> {
  return post<AdminUserSubscriptionDetailResponse>(
    `/admin/payments/subscriptions/${id}/extend`,
    data
  );
}

/* ========== Invoices ========== */

export async function fetchInvoiceStats(): Promise<ApiResponse<AdminInvoiceStatsResponse>> {
  return get<AdminInvoiceStatsResponse>('/admin/payments/invoices/stats');
}

export async function fetchInvoices(
  params: InvoicesQueryParams = {}
): Promise<ApiResponse<AdminInvoiceListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    userId: params.userId,
    subscriptionId: params.subscriptionId,
    status: params.status,
    minAmount: params.minAmount,
    maxAmount: params.maxAmount,
    sort: params.sort ?? 'invoiceDate',
    order: params.order ?? 'desc',
  };
  return get<AdminInvoiceListItem[]>('/admin/payments/invoices', query);
}

export async function fetchInvoice(id: string): Promise<ApiResponse<AdminInvoiceDetailResponse>> {
  return get<AdminInvoiceDetailResponse>(`/admin/payments/invoices/${id}`);
}

export async function updateInvoiceStatus(
  id: string,
  data: UpdateInvoiceStatusInput
): Promise<ApiResponse<AdminInvoiceDetailResponse>> {
  return patch<AdminInvoiceDetailResponse>(`/admin/payments/invoices/${id}/status`, data);
}

export async function resendInvoice(
  id: string
): Promise<ApiResponse<{ message: string }>> {
  return post<{ message: string }>(`/admin/payments/invoices/${id}/resend`, {});
}

/* ========== Wallet Transactions ========== */

export async function fetchTransactionStats(): Promise<
  ApiResponse<AdminTransactionStatsResponse>
> {
  return get<AdminTransactionStatsResponse>('/admin/wallets/transactions/stats');
}

export async function fetchTransactions(
  params: TransactionsQueryParams = {}
): Promise<ApiResponse<AdminTransactionListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    walletId: params.walletId,
    userId: params.userId,
    actionType: params.actionType,
    status: params.status,
    minAmount: params.minAmount,
    maxAmount: params.maxAmount,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminTransactionListItem[]>('/admin/wallets/transactions', query);
}

export async function fetchTransaction(
  id: string
): Promise<ApiResponse<AdminTransactionDetailResponse>> {
  return get<AdminTransactionDetailResponse>(`/admin/wallets/transactions/${id}`);
}

/* ========== Rewards ========== */

export async function fetchRewardStats(): Promise<ApiResponse<AdminRewardStatsResponse>> {
  return get<AdminRewardStatsResponse>('/admin/payments/rewards/stats');
}

export async function fetchRewards(
  params: RewardsQueryParams = {}
): Promise<ApiResponse<AdminRewardListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    userId: params.userId,
    type: params.type,
    status: params.status,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminRewardListItem[]>('/admin/payments/rewards', query);
}

export async function fetchReward(id: string): Promise<ApiResponse<AdminRewardDetailResponse>> {
  return get<AdminRewardDetailResponse>(`/admin/payments/rewards/${id}`);
}

export async function createReward(
  data: CreateRewardInput
): Promise<ApiResponse<AdminRewardDetailResponse>> {
  return post<AdminRewardDetailResponse>('/admin/payments/rewards', data);
}

export async function claimReward(
  id: string
): Promise<ApiResponse<{ message: string }>> {
  return post<{ message: string }>(`/admin/payments/rewards/${id}/claim`, {});
}

// ==================== Aliases for Subscriptions ====================
// These aliases are for backward compatibility with components expecting shorter names

export type AdminSubscriptionStatsResponse = AdminUserSubscriptionStatsResponse;
export type AdminSubscriptionListItem = AdminUserSubscriptionListItem;
export type AdminSubscriptionDetailResponse = AdminUserSubscriptionDetailResponse;

export const fetchSubscriptionStats = fetchUserSubscriptionStats;
export const fetchSubscriptions = fetchUserSubscriptions;
export const fetchSubscription = fetchUserSubscription;
export const extendSubscription = extendUserSubscription;
