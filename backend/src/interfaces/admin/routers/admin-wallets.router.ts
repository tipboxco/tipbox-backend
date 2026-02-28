import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError, ValidationError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';

// Import schemas
import {
  AdminWalletsQuerySchema,
  AdminAdjustWalletBalanceSchema,
  AdminTransactionsQuerySchema,
  AdminTipsQuerySchema,
  AdminTipsAnalyticsQuerySchema,
} from '../schemas/admin-payments.schemas';

// Import DTOs
import type {
  AdminWalletStatsResponse,
  AdminWalletListItem,
  AdminWalletDetailResponse,
  AdminTransactionStatsResponse,
  AdminTransactionListItem,
  AdminTransactionDetailResponse,
  AdminTipsStatsResponse,
  AdminTipsListItem,
  AdminTipsAnalyticsResponse,
  AdminAdjustWalletBalanceInput,
} from '../dtos/admin-payments.dto';

import type { PaginationMeta } from '../dtos/admin-common.dto';

const router = Router();
const prisma = getPrisma();

/**
 * Wallets Router
 * Routes are mounted at /admin/wallets
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Wallets ====================

/**
 * GET /admin/wallets/stats
 * Get wallets statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const [total, connected] = await Promise.all([
      prisma.wallet.count(),
      prisma.wallet.count({ where: { isConnected: true } }),
    ]);

    // Total balances
    const wallets = await prisma.wallet.findMany({
      select: { balance: true, lockedBalance: true },
    });
    const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
    const totalLockedBalance = wallets.reduce((sum, w) => sum + w.lockedBalance, 0);

    // By provider
    const byProvider = await prisma.wallet.groupBy({
      by: ['provider'],
      _count: { id: true },
    });

    const data: AdminWalletStatsResponse = {
      total,
      connected,
      disconnected: total - connected,
      totalBalance,
      totalLockedBalance,
      byProvider: Object.fromEntries(byProvider.map((p) => [p.provider, p._count.id])),
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/wallets
 * List wallets with pagination and filters
 */
router.get(
  '/',
  validateQuery(AdminWalletsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      userId?: string;
      provider?: string;
      isConnected?: boolean;
      minBalance?: number;
      maxBalance?: number;
      search?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.userId) where.userId = q.userId;
    if (q.provider) where.provider = q.provider;
    if (q.isConnected !== undefined) where.isConnected = q.isConnected;
    if (q.minBalance !== undefined || q.maxBalance !== undefined) {
      where.balance = {};
      if (q.minBalance !== undefined)
        (where.balance as Record<string, unknown>).gte = q.minBalance;
      if (q.maxBalance !== undefined)
        (where.balance as Record<string, unknown>).lte = q.maxBalance;
    }

    // Search by username or publicAddress
    if (q.search) {
      where.OR = [
        { publicAddress: { contains: q.search, mode: 'insensitive' } },
        { user: { profile: { username: { contains: q.search, mode: 'insensitive' } } } },
      ];
    }

    const [wallets, total] = await Promise.all([
      prisma.wallet.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { userName: true } },
            },
          },
          _count: { select: { transactions: true } },
        },
      }),
      prisma.wallet.count({ where }),
    ]);

    const data: AdminWalletListItem[] = wallets.map((wallet) => ({
      id: wallet.id,
      userId: wallet.userId,
      userEmail: wallet.user.email,
      username: wallet.user.profile?.userName || null,
      publicAddress: wallet.publicAddress,
      provider: wallet.provider,
      isConnected: wallet.isConnected,
      balance: wallet.balance,
      lockedBalance: wallet.lockedBalance,
      transactionCount: wallet._count.transactions,
      createdAt: wallet.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/wallets/:id
 * Get wallet details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const wallet = await prisma.wallet.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { userName: true } },
          },
        },
        _count: { select: { transactions: true } },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            wallet: {
              select: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    profile: { select: { userName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    const recentTransactions: AdminTransactionListItem[] = wallet.transactions.map((tx) => ({
      id: tx.id,
      walletId: tx.walletId,
      userId: wallet.userId,
      userEmail: wallet.user.email,
      username: wallet.user.profile?.userName || null,
      actionType: tx.actionType,
      status: tx.status,
      amount: tx.amount,
      fromAddress: tx.fromAddress,
      toAddress: tx.toAddress,
      txHash: tx.txHash,
      provider: tx.provider,
      errorMessage: tx.errorMessage,
      createdAt: tx.createdAt.toISOString(),
      confirmedAt: tx.confirmedAt?.toISOString() || null,
      failedAt: tx.failedAt?.toISOString() || null,
    }));

    const data: AdminWalletDetailResponse = {
      id: wallet.id,
      userId: wallet.userId,
      userEmail: wallet.user.email,
      username: wallet.user.profile?.userName || null,
      publicAddress: wallet.publicAddress,
      provider: wallet.provider,
      isConnected: wallet.isConnected,
      balance: wallet.balance,
      lockedBalance: wallet.lockedBalance,
      transactionCount: wallet._count.transactions,
      createdAt: wallet.createdAt.toISOString(),
      updatedAt: wallet.updatedAt.toISOString(),
      recentTransactions,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/wallets/:id/transactions
 * Get wallet transaction history
 */
router.get(
  '/:id/transactions',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Number(req.query.offset) || 0;

    const wallet = await prisma.wallet.findUnique({ where: { id } });
    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { walletId: id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({ where: { walletId: id } }),
    ]);

    const pagination: PaginationMeta = { total, limit, offset };
    return res.json({ success: true, data: transactions, pagination });
  })
);

/**
 * PATCH /admin/wallets/:id/adjust
 * Adjust wallet balance (admin tool)
 */
router.patch(
  '/:id/adjust',
  validateBody(AdminAdjustWalletBalanceSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminAdjustWalletBalanceInput;

    const wallet = await prisma.wallet.findUnique({ where: { id } });
    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    // Calculate new balance
    const newBalance = wallet.balance + body.amount;
    if (newBalance < 0) {
      throw new ValidationError('Resulting balance cannot be negative');
    }

    let newLockedBalance = wallet.lockedBalance;
    if (body.adjustLockedBalance) {
      newLockedBalance = wallet.lockedBalance + body.amount;
      if (newLockedBalance < 0) {
        throw new ValidationError('Resulting locked balance cannot be negative');
      }
    }

    const updatedWallet = await prisma.wallet.update({
      where: { id },
      data: {
        balance: newBalance,
        ...(body.adjustLockedBalance && { lockedBalance: newLockedBalance }),
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'WALLET_ADJUST_BALANCE',
        description: `walletId: ${id}, amount: ${body.amount}, reason: ${body.reason}, adjustLocked: ${body.adjustLockedBalance}`,
        entityType: 'wallet',
        entityId: 0,
      },
    });

    logger.info('Wallet balance adjusted by admin', {
      walletId: id,
      amount: body.amount,
      reason: body.reason,
      adminId,
    });

    return res.json({ success: true, data: updatedWallet });
  })
);

// ==================== Transactions ====================

/**
 * GET /admin/wallets/transactions/stats
 * Get transactions statistics
 */
router.get(
  '/transactions/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const [total, created, pending, confirmed, failed] = await Promise.all([
      prisma.transaction.count(),
      prisma.transaction.count({ where: { status: 'created' } }),
      prisma.transaction.count({ where: { status: 'pending' } }),
      prisma.transaction.count({ where: { status: 'confirmed' } }),
      prisma.transaction.count({ where: { status: 'failed' } }),
    ]);

    // Total volume
    const confirmedTxs = await prisma.transaction.findMany({
      where: { status: 'confirmed', amount: { not: null } },
      select: { amount: true },
    });
    const totalVolume = confirmedTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // Volume this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const txsThisMonth = await prisma.transaction.findMany({
      where: {
        status: 'confirmed',
        confirmedAt: { gte: startOfMonth },
        amount: { not: null },
      },
      select: { amount: true },
    });
    const volumeThisMonth = txsThisMonth.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // By action type
    const byActionType = await prisma.transaction.groupBy({
      by: ['actionType'],
      _count: { id: true },
    });

    const data: AdminTransactionStatsResponse = {
      total,
      created,
      pending,
      confirmed,
      failed,
      totalVolume,
      volumeThisMonth,
      byActionType: Object.fromEntries(byActionType.map((a) => [a.actionType, a._count.id])),
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/wallets/transactions
 * List all transactions with pagination and filters
 */
router.get(
  '/transactions',
  validateQuery(AdminTransactionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      walletId?: string;
      userId?: string;
      actionType?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
      minAmount?: number;
      maxAmount?: number;
      search?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.walletId) where.walletId = q.walletId;
    if (q.actionType) where.actionType = q.actionType;
    if (q.status) where.status = q.status;
    if (q.startDate || q.endDate) {
      where.createdAt = {};
      if (q.startDate) (where.createdAt as Record<string, unknown>).gte = q.startDate;
      if (q.endDate) (where.createdAt as Record<string, unknown>).lte = q.endDate;
    }
    if (q.minAmount !== undefined || q.maxAmount !== undefined) {
      where.amount = {};
      if (q.minAmount !== undefined)
        (where.amount as Record<string, unknown>).gte = q.minAmount;
      if (q.maxAmount !== undefined)
        (where.amount as Record<string, unknown>).lte = q.maxAmount;
    }

    // Search by txHash or address
    if (q.search) {
      where.OR = [
        { txHash: { contains: q.search, mode: 'insensitive' } },
        { fromAddress: { contains: q.search, mode: 'insensitive' } },
        { toAddress: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    // Filter by userId if provided
    if (q.userId) {
      where.wallet = { userId: q.userId };
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          wallet: {
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  profile: { select: { userName: true } },
                },
              },
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    const data: AdminTransactionListItem[] = transactions.map((tx) => ({
      id: tx.id,
      walletId: tx.walletId,
      userId: tx.wallet.userId,
      userEmail: tx.wallet.user.email,
      username: tx.wallet.user.profile?.userName || null,
      actionType: tx.actionType,
      status: tx.status,
      amount: tx.amount,
      fromAddress: tx.fromAddress,
      toAddress: tx.toAddress,
      txHash: tx.txHash,
      provider: tx.provider,
      errorMessage: tx.errorMessage,
      createdAt: tx.createdAt.toISOString(),
      confirmedAt: tx.confirmedAt?.toISOString() || null,
      failedAt: tx.failedAt?.toISOString() || null,
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/wallets/transactions/:id
 * Get transaction details
 */
router.get(
  '/transactions/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        wallet: {
          select: {
            id: true,
            publicAddress: true,
            provider: true,
            balance: true,
            userId: true,
            user: {
              select: {
                id: true,
                email: true,
                profile: { select: { userName: true } },
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    const data: AdminTransactionDetailResponse = {
      id: transaction.id,
      walletId: transaction.walletId,
      userId: transaction.wallet.userId,
      userEmail: transaction.wallet.user.email,
      username: transaction.wallet.user.profile?.userName || null,
      actionType: transaction.actionType,
      status: transaction.status,
      amount: transaction.amount,
      fromAddress: transaction.fromAddress,
      toAddress: transaction.toAddress,
      txHash: transaction.txHash,
      provider: transaction.provider,
      errorMessage: transaction.errorMessage,
      createdAt: transaction.createdAt.toISOString(),
      confirmedAt: transaction.confirmedAt?.toISOString() || null,
      failedAt: transaction.failedAt?.toISOString() || null,
      metadata: transaction.metadata as Record<string, unknown> | null,
      wallet: {
        id: transaction.wallet.id,
        publicAddress: transaction.wallet.publicAddress,
        provider: transaction.wallet.provider,
        balance: transaction.wallet.balance,
      },
    };

    return res.json({ success: true, data });
  })
);

/**
 * POST /admin/wallets/transactions/:id/retry
 * Retry failed transaction
 */
router.post(
  '/transactions/:id/retry',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({ where: { id } });
    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    if (transaction.status !== 'failed') {
      throw new ValidationError('Only failed transactions can be retried');
    }

    // Update status back to pending for retry
    const updatedTx = await prisma.transaction.update({
      where: { id },
      data: {
        status: 'pending',
        errorMessage: null,
        failedAt: null,
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'TRANSACTION_RETRY',
        description: `transactionId: ${id}, actionType: ${transaction.actionType}`,
        entityType: 'transaction',
        entityId: 0,
      },
    });

    logger.info('Transaction retry initiated by admin', { transactionId: id, adminId });

    // TODO: Trigger transaction processor to re-process this transaction

    return res.json({
      success: true,
      message: 'Transaction retry queued',
      data: updatedTx,
    });
  })
);

/**
 * POST /admin/wallets/transactions/:id/refund
 * Refund transaction (create reverse transaction)
 */
router.post(
  '/transactions/:id/refund',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { wallet: true },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    if (transaction.status !== 'confirmed') {
      throw new ValidationError('Only confirmed transactions can be refunded');
    }

    if (!transaction.amount || transaction.amount <= 0) {
      throw new ValidationError('Transaction has no valid amount to refund');
    }

    // Create reverse transaction
    const refundTx = await prisma.transaction.create({
      data: {
        walletId: transaction.walletId,
        actionType: transaction.actionType,
        status: 'confirmed',
        amount: -transaction.amount, // Negative amount for refund
        fromAddress: transaction.toAddress,
        toAddress: transaction.fromAddress,
        provider: 'admin_refund',
        metadata: {
          refundOf: transaction.id,
          refundedBy: adminId,
          refundedAt: new Date().toISOString(),
        },
        confirmedAt: new Date(),
      },
    });

    // Update wallet balance
    await prisma.wallet.update({
      where: { id: transaction.walletId },
      data: {
        balance: { increment: transaction.amount },
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'TRANSACTION_REFUND',
        description: `transactionId: ${id}, amount: ${transaction.amount}, refundTxId: ${refundTx.id}`,
        entityType: 'transaction',
        entityId: 0,
      },
    });

    logger.info('Transaction refunded by admin', {
      transactionId: id,
      refundTxId: refundTx.id,
      amount: transaction.amount,
      adminId,
    });

    return res.json({
      success: true,
      message: 'Transaction refunded successfully',
      data: { originalTx: transaction, refundTx },
    });
  })
);

// ==================== Tips Transfers ====================

/**
 * GET /admin/wallets/tips/stats
 * Get tips statistics
 */
router.get(
  '/tips/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const total = await prisma.tipsTokenTransfer.count();

    // Total volume
    const allTips = await prisma.tipsTokenTransfer.findMany({
      select: { amount: true },
    });
    const totalVolume = allTips.reduce((sum, tip) => sum + tip.amount, 0);

    // Volume this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const tipsThisMonth = await prisma.tipsTokenTransfer.findMany({
      where: { createdAt: { gte: startOfMonth } },
      select: { amount: true },
    });
    const volumeThisMonth = tipsThisMonth.reduce((sum, tip) => sum + tip.amount, 0);

    // Top tippers
    const topTippersRaw = await prisma.tipsTokenTransfer.groupBy({
      by: ['fromUserId'],
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    });

    const topTippers = await Promise.all(
      topTippersRaw.map(async (tipper) => {
        const user = await prisma.user.findUnique({
          where: { id: tipper.fromUserId },
          select: { id: true, profile: { select: { userName: true } } },
        });
        return {
          userId: tipper.fromUserId,
          username: user?.profile?.userName || null,
          totalSent: tipper._sum.amount || 0,
          count: tipper._count.id,
        };
      })
    );

    // Top receivers
    const topReceiversRaw = await prisma.tipsTokenTransfer.groupBy({
      by: ['toUserId'],
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    });

    const topReceivers = await Promise.all(
      topReceiversRaw.map(async (receiver) => {
        const user = await prisma.user.findUnique({
          where: { id: receiver.toUserId },
          select: { id: true, profile: { select: { userName: true } } },
        });
        return {
          userId: receiver.toUserId,
          username: user?.profile?.userName || null,
          totalReceived: receiver._sum.amount || 0,
          count: receiver._count.id,
        };
      })
    );

    const data: AdminTipsStatsResponse = {
      total,
      totalVolume,
      volumeThisMonth,
      topTippers,
      topReceivers,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/wallets/tips
 * List tips transfers with pagination and filters
 */
router.get(
  '/tips',
  validateQuery(AdminTipsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      fromUserId?: string;
      toUserId?: string;
      startDate?: Date;
      endDate?: Date;
      minAmount?: number;
      maxAmount?: number;
      search?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.fromUserId) where.fromUserId = q.fromUserId;
    if (q.toUserId) where.toUserId = q.toUserId;
    if (q.startDate || q.endDate) {
      where.createdAt = {};
      if (q.startDate) (where.createdAt as Record<string, unknown>).gte = q.startDate;
      if (q.endDate) (where.createdAt as Record<string, unknown>).lte = q.endDate;
    }
    if (q.minAmount !== undefined || q.maxAmount !== undefined) {
      where.amount = {};
      if (q.minAmount !== undefined)
        (where.amount as Record<string, unknown>).gte = q.minAmount;
      if (q.maxAmount !== undefined)
        (where.amount as Record<string, unknown>).lte = q.maxAmount;
    }

    // Search by username
    if (q.search) {
      where.OR = [
        { fromUser: { profile: { username: { contains: q.search, mode: 'insensitive' } } } },
        { toUser: { profile: { username: { contains: q.search, mode: 'insensitive' } } } },
      ];
    }

    const [tips, total] = await Promise.all([
      prisma.tipsTokenTransfer.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          fromUser: {
            select: {
              id: true,
              email: true,
              profile: { select: { userName: true } },
            },
          },
          toUser: {
            select: {
              id: true,
              email: true,
              profile: { select: { userName: true } },
            },
          },
        },
      }),
      prisma.tipsTokenTransfer.count({ where }),
    ]);

    const data: AdminTipsListItem[] = tips.map((tip) => ({
      id: tip.id,
      fromUserId: tip.fromUserId,
      fromUsername: tip.fromUser.profile?.userName || null,
      fromEmail: tip.fromUser.email,
      toUserId: tip.toUserId,
      toUsername: tip.toUser.profile?.userName || null,
      toEmail: tip.toUser.email,
      amount: tip.amount,
      reason: tip.reason,
      createdAt: tip.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/wallets/tips/analytics
 * Get tips analytics with time-series data
 */
router.get(
  '/tips/analytics',
  validateQuery(AdminTipsAnalyticsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      startDate?: Date;
      endDate?: Date;
      groupBy: 'day' | 'week' | 'month';
    };

    const where: Record<string, unknown> = {};
    if (q.startDate || q.endDate) {
      where.createdAt = {};
      if (q.startDate) (where.createdAt as Record<string, unknown>).gte = q.startDate;
      if (q.endDate) (where.createdAt as Record<string, unknown>).lte = q.endDate;
    }

    const tips = await prisma.tipsTokenTransfer.findMany({
      where,
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by time period
    const volumeMap = new Map<string, { volume: number; count: number }>();

    tips.forEach((tip) => {
      const date = new Date(tip.createdAt);
      let key: string;

      if (q.groupBy === 'day') {
        key = date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (q.groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        // month
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      const existing = volumeMap.get(key) || { volume: 0, count: 0 };
      volumeMap.set(key, {
        volume: existing.volume + tip.amount,
        count: existing.count + 1,
      });
    });

    const volumeOverTime = Array.from(volumeMap.entries())
      .map(([date, data]) => ({
        date,
        volume: data.volume,
        count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalVolume = tips.reduce((sum, tip) => sum + tip.amount, 0);
    const totalCount = tips.length;
    const avgTipAmount = totalCount > 0 ? totalVolume / totalCount : 0;

    const data: AdminTipsAnalyticsResponse = {
      volumeOverTime,
      avgTipAmount,
      totalVolume,
      totalCount,
    };

    return res.json({ success: true, data });
  })
);

export default router;
