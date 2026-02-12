import { z } from 'zod';

/* ========== Subscription Plans ========== */

export const AdminSubscriptionPlansQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  period: z.enum(['MONTHLY', 'YEARLY']).optional(),
  sort: z.enum(['createdAt', 'displayOrder', 'price']).default('displayOrder'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const AdminCreateSubscriptionPlanSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().min(0),
  currency: z.string().default('USD'),
  period: z.enum(['MONTHLY', 'YEARLY']),
  benefits: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
});

export const AdminUpdateSubscriptionPlanSchema = AdminCreateSubscriptionPlanSchema.partial();

export const AdminReorderSubscriptionPlanSchema = z.object({
  displayOrder: z.number().int().min(0),
});

/* ========== User Subscriptions ========== */

export const AdminUserSubscriptionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  userId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  status: z.enum(['active', 'trialing', 'canceled', 'past_due']).optional(),
  search: z.string().optional(), // email or username
  sort: z.enum(['createdAt', 'currentPeriodEnd']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminExtendSubscriptionSchema = z.object({
  days: z.number().int().min(1).max(365),
});

/* ========== Invoices ========== */

export const AdminInvoicesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  userId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  status: z.enum(['Paid', 'Pending', 'Failed']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().optional(), // email or username
  sort: z.enum(['createdAt', 'invoiceDate', 'amount']).default('invoiceDate'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminUpdateInvoiceSchema = z.object({
  status: z.enum(['Paid', 'Pending', 'Failed']),
  paidAt: z.coerce.date().optional(),
});

/* ========== Wallets ========== */

export const AdminWalletsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  userId: z.string().uuid().optional(),
  provider: z.enum(['METAMASK', 'WALLETCONNECT', 'CUSTOM']).optional(),
  isConnected: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  minBalance: z.coerce.number().min(0).optional(),
  maxBalance: z.coerce.number().min(0).optional(),
  search: z.string().optional(), // username or publicAddress
  sort: z.enum(['createdAt', 'balance']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminAdjustWalletBalanceSchema = z.object({
  amount: z.number(),
  reason: z.string().min(1).max(500),
  adjustLockedBalance: z.boolean().default(false),
});

/* ========== Transactions ========== */

export const AdminTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  walletId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  actionType: z
    .enum(['TIP_SEND', 'TIP_RECEIVE', 'CLAIM_REWARD', 'CLAIM_BADGE', 'NFT_BUY'])
    .optional(),
  status: z.enum(['created', 'pending', 'confirmed', 'failed']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  search: z.string().optional(), // txHash or address
  sort: z.enum(['createdAt', 'amount', 'confirmedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/* ========== Tips Transfers ========== */

export const AdminTipsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  fromUserId: z.string().uuid().optional(),
  toUserId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  search: z.string().optional(), // username
  sort: z.enum(['createdAt', 'amount']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminTipsAnalyticsQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});
