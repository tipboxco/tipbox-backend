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
  period: string; // MONTHLY | YEARLY
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

/* ========== User Subscriptions ========== */

export type AdminUserSubscriptionStatsResponse = {
  total: number;
  active: number;
  trialing: number;
  canceled: number;
  pastDue: number;
  revenueThisMonth: number;
  churnRate: number; // percentage
};

export type AdminUserSubscriptionListItem = {
  id: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  planId: string;
  planName: string;
  status: string; // active | trialing | canceled | past_due
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
  status: string; // Paid | Pending | Failed
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

/* ========== Wallets ========== */

export type AdminWalletStatsResponse = {
  total: number;
  connected: number;
  disconnected: number;
  totalBalance: number;
  totalLockedBalance: number;
  byProvider: Record<string, number>; // provider -> count
};

export type AdminWalletListItem = {
  id: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  publicAddress: string;
  provider: string; // METAMASK | WALLETCONNECT | CUSTOM
  isConnected: boolean;
  balance: number;
  lockedBalance: number;
  transactionCount: number;
  createdAt: string;
};

export type AdminWalletDetailResponse = AdminWalletListItem & {
  updatedAt: string;
  recentTransactions: AdminTransactionListItem[];
};

/* ========== Transactions ========== */

export type AdminTransactionStatsResponse = {
  total: number;
  created: number;
  pending: number;
  confirmed: number;
  failed: number;
  totalVolume: number;
  volumeThisMonth: number;
  byActionType: Record<string, number>; // actionType -> count
};

export type AdminTransactionListItem = {
  id: string;
  walletId: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  actionType: string; // TIP_SEND | TIP_RECEIVE | CLAIM_REWARD | etc
  status: string; // created | pending | confirmed | failed
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

/* ========== Tips Transfers ========== */

export type AdminTipsStatsResponse = {
  total: number;
  totalVolume: number;
  volumeThisMonth: number;
  thisWeek: number;
  avgAmount: number;
  topSenders: {
    userId: string;
    username: string | null;
    totalSent: number;
    count: number;
  }[];
  topReceivers: {
    userId: string;
    username: string | null;
    totalReceived: number;
    count: number;
  }[];
};

export type AdminTipsListItem = {
  id: string;
  fromUserId: string;
  fromUsername: string | null;
  fromEmail: string | null;
  toUserId: string;
  toUsername: string | null;
  toEmail: string | null;
  amount: number;
  reason: string | null;
  createdAt: string;
};

export type AdminTipsAnalyticsResponse = {
  volumeOverTime: {
    date: string;
    volume: number;
    count: number;
  }[];
  avgTipAmount: number;
  totalVolume: number;
  totalCount: number;
};

/* ========== Input Types (inferred from schemas) ========== */

import type {
  AdminCreateSubscriptionPlanSchema,
  AdminUpdateSubscriptionPlanSchema,
  AdminExtendSubscriptionSchema,
  AdminUpdateInvoiceSchema,
  AdminAdjustWalletBalanceSchema,
} from '../schemas/admin-payments.schemas';
import type { z } from 'zod';

export type AdminCreateSubscriptionPlanInput = z.infer<typeof AdminCreateSubscriptionPlanSchema>;
export type AdminUpdateSubscriptionPlanInput = z.infer<typeof AdminUpdateSubscriptionPlanSchema>;
export type AdminExtendSubscriptionInput = z.infer<typeof AdminExtendSubscriptionSchema>;
export type AdminUpdateInvoiceInput = z.infer<typeof AdminUpdateInvoiceSchema>;
export type AdminAdjustWalletBalanceInput = z.infer<typeof AdminAdjustWalletBalanceSchema>;
