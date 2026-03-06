import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError, ValidationError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';
import { v4 as uuidv4 } from 'uuid';
import { createUpload } from '../../../infrastructure/config/file-upload.config';
import { validateFileType } from '../../../infrastructure/middleware/file-type-validation.middleware';
import { S3Service } from '../../../infrastructure/s3/s3.service';
import { resolveMediaUrl } from '../../../infrastructure/config/media.config';

// Import schemas
import {
  AdminNFTQuerySchema,
  AdminCreateNFTSchema,
  AdminUpdateNFTSchema,
  AdminTransferNFTSchema,
  AdminNFTTransactionsQuerySchema,
  AdminNFTMarketListingsQuerySchema,
  AdminModerateListingSchema,
  AdminLootboxQuerySchema,
  AdminUnlockLootboxSchema,
} from '../schemas/admin-nft.schemas';

// Import DTOs
import type {
  AdminNFTStatsResponse,
  AdminNFTListItem,
  AdminNFTDetailResponse,
  AdminNFTTransactionListItem,
  AdminNFTMarketListingListItem,
  AdminLootboxStatsResponse,
  AdminLootboxListItem,
  AdminCreateNFTInput,
  AdminUpdateNFTInput,
  AdminTransferNFTInput,
  AdminModerateListingInput,
  AdminUnlockLootboxInput,
} from '../dtos/admin-nft.dto';

import type { PaginationMeta } from '../dtos/admin-common.dto';

const router = Router();
const prisma = getPrisma();
const s3Service = new S3Service();

const nftUpload = createUpload('ADMIN_IMAGES', 'MEDIUM');

/**
 * NFT & Marketplace Management Router
 * Routes are mounted at /admin/nft
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== NFT ====================

/**
 * @openapi
 * /api/admin/nft/upload-image:
 *   post:
 *     summary: Upload NFT image to MinIO (nfts/ folder)
 *     tags: [Admin - NFT]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: NFT image (JPG, PNG, GIF, WebP - max 10MB)
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *       400:
 *         description: File required or unsupported format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin required)
 */
router.post(
  '/upload-image',
  nftUpload.single('file'),
  validateFileType('ADMIN_IMAGES'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File required (field: file)' });
    }
    const ext = req.file.originalname?.split('.').pop()?.toLowerCase() || 'jpg';
    const allowedExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowedExt.includes(ext)) {
      return res.status(400).json({ success: false, message: 'Only JPG, PNG, GIF and WebP supported' });
    }
    const fileName = `nfts/${uuidv4()}.${ext}`;
    const path = await s3Service.uploadFile(fileName, req.file.buffer, req.file.mimetype);
    const url = resolveMediaUrl(path);
    logger.info({
      message: 'NFT image uploaded',
      fileName,
      url,
      adminId: req.user?.id,
    });
    return res.json({ success: true, data: { url: url ?? path } });
  })
);

/**
 * GET /admin/nft/stats
 * Get NFT statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const total = await prisma.nFT.count();

    // By type
    const byTypeRaw = await prisma.nFT.groupBy({
      by: ['type'],
      _count: { id: true },
    });
    const byType: Record<string, number> = {};
    byTypeRaw.forEach((item) => {
      byType[item.type] = item._count.id;
    });

    // By rarity
    const byRarityRaw = await prisma.nFT.groupBy({
      by: ['rarity'],
      _count: { id: true },
    });
    const byRarity: Record<string, number> = {};
    byRarityRaw.forEach((item) => {
      byRarity[item.rarity] = item._count.id;
    });

    // Total transactions
    const totalTransactions = await prisma.nFTTransaction.count();

    // Active listings
    const activeListings = await prisma.nFTMarketListing.count({
      where: { status: 'ACTIVE' },
    });

    // Most viewed NFTs
    const topViewed = await prisma.nFT.findMany({
      orderBy: { viewCount: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        viewCount: true,
      },
    });

    const mostViewedNFTs = topViewed.map((nft) => ({
      nftId: nft.id,
      name: nft.name,
      viewCount: nft.viewCount,
    }));

    const data: AdminNFTStatsResponse = {
      total,
      byType,
      byRarity,
      totalTransactions,
      activeListings,
      mostViewedNFTs,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/nft
 * List NFTs with pagination and filters
 */
router.get(
  '/',
  validateQuery(AdminNFTQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      search?: string;
      type?: string;
      rarity?: string;
      currentOwnerId?: string;
      isTransferable?: boolean;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.type) where.type = q.type;
    if (q.rarity) where.rarity = q.rarity;
    if (q.currentOwnerId) where.currentOwnerId = q.currentOwnerId;
    if (q.isTransferable !== undefined) where.isTransferable = q.isTransferable;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [nfts, total] = await Promise.all([
      prisma.nFT.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          currentOwner: {
            select: {
              id: true,
              profile: { select: { userName: true } },
            },
          },
          _count: {
            select: { transactions: true },
          },
        },
      }),
      prisma.nFT.count({ where }),
    ]);

    const data: AdminNFTListItem[] = nfts.map((nft) => ({
      id: nft.id,
      name: nft.name,
      description: nft.description,
      imageUrl: nft.imageUrl,
      type: nft.type,
      rarity: nft.rarity,
      isTransferable: nft.isTransferable,
      currentOwnerId: nft.currentOwnerId,
      currentOwnerUsername: nft.currentOwner?.profile?.userName || null,
      viewCount: nft.viewCount,
      transactionCount: nft._count.transactions,
      createdAt: nft.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/nft/:id
 * Get NFT details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const nft = await prisma.nFT.findUnique({
      where: { id },
      include: {
        currentOwner: {
          select: {
            id: true,
            email: true,
            profile: { select: { userName: true } },
          },
        },
        attributes: {
          select: {
            id: true,
            traitType: true,
            value: true,
          },
        },
        transactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            fromUser: {
              select: {
                id: true,
                profile: { select: { userName: true } },
              },
            },
            toUser: {
              select: {
                id: true,
                profile: { select: { userName: true } },
              },
            },
          },
        },
        marketListings: {
          take: 5,
          orderBy: { listedAt: 'desc' },
          select: {
            id: true,
            price: true,
            status: true,
            listedAt: true,
          },
        },
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!nft) {
      throw new NotFoundError('NFT not found');
    }

    const data: AdminNFTDetailResponse = {
      id: nft.id,
      name: nft.name,
      description: nft.description,
      imageUrl: nft.imageUrl,
      type: nft.type,
      rarity: nft.rarity,
      isTransferable: nft.isTransferable,
      currentOwnerId: nft.currentOwnerId,
      currentOwnerUsername: nft.currentOwner?.profile?.userName || null,
      viewCount: nft.viewCount,
      transactionCount: nft._count.transactions,
      createdAt: nft.createdAt.toISOString(),
      updatedAt: nft.updatedAt.toISOString(),
      attributes: nft.attributes.map((attr) => ({
        id: attr.id,
        traitType: attr.traitType,
        value: attr.value,
      })),
      currentOwner: nft.currentOwner
        ? {
            id: nft.currentOwner.id,
            email: nft.currentOwner.email,
            username: nft.currentOwner.profile?.userName || null,
          }
        : null,
      recentTransactions: nft.transactions.map((tx) => ({
        id: tx.id,
        fromUserId: tx.fromUserId,
        fromUsername: tx.fromUser?.profile?.userName || null,
        toUserId: tx.toUserId,
        toUsername: tx.toUser.profile?.userName || null,
        transactionType: tx.transactionType,
        price: tx.price,
        createdAt: tx.createdAt.toISOString(),
      })),
      marketListings: nft.marketListings.map((listing) => ({
        id: listing.id,
        price: listing.price,
        status: listing.status,
        listedAt: listing.listedAt.toISOString(),
      })),
    };

    return res.json({ success: true, data });
  })
);

/**
 * POST /admin/nft
 * Create/mint NFT
 */
router.post(
  '/',
  validateBody(AdminCreateNFTSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const body = req.body as AdminCreateNFTInput;

    // Create NFT with attributes in transaction
    const nft = await prisma.$transaction(async (tx) => {
      const newNFT = await tx.nFT.create({
        data: {
          name: body.name,
          description: body.description ?? null,
          imageUrl: body.imageUrl,
          type: body.type,
          rarity: body.rarity,
          isTransferable: body.isTransferable,
          currentOwnerId: body.currentOwnerId ?? null,
        },
      });

      // Create attributes if provided
      if (body.attributes && body.attributes.length > 0) {
        await tx.nFTAttribute.createMany({
          data: body.attributes.map((attr) => ({
            nftId: newNFT.id,
            traitType: attr.traitType,
            value: attr.value,
          })),
        });
      }

      // Create mint transaction
      await tx.nFTTransaction.create({
        data: {
          nftId: newNFT.id,
          fromUserId: null, // Minted from system
          toUserId: body.currentOwnerId || adminId,
          transactionType: 'MINT',
          price: null,
        },
      });

      return newNFT;
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'NFT_CREATE',
        description: `nftId: ${nft.id}, name: ${nft.name}, type: ${nft.type}, rarity: ${nft.rarity}`,
        entityType: 'nft',
        entityId: 0,
      },
    });

    logger.info('NFT created', { nftId: nft.id, adminId });

    return res.status(201).json({ success: true, data: nft });
  })
);

/**
 * PATCH /admin/nft/:id
 * Update NFT metadata
 */
router.patch(
  '/:id',
  validateBody(AdminUpdateNFTSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminUpdateNFTInput;

    const existing = await prisma.nFT.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('NFT not found');
    }

    // Clean up old image from S3 if being replaced
    if (body.imageUrl !== undefined && existing.imageUrl && body.imageUrl !== existing.imageUrl) {
      try { await s3Service.deleteFile(existing.imageUrl); } catch { /* ignore */ }
    }

    const nft = await prisma.nFT.update({
      where: { id },
      data: body,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'NFT_UPDATE',
        description: `nftId: ${nft.id}, name: ${nft.name}`,
        entityType: 'nft',
        entityId: 0,
      },
    });

    logger.info('NFT updated', { nftId: nft.id, adminId });

    return res.json({ success: true, data: nft });
  })
);

/**
 * DELETE /admin/nft/:id
 * Delete NFT (only if no transactions except mint)
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;

    const existing = await prisma.nFT.findUnique({
      where: { id },
      include: {
        _count: {
          select: { transactions: true, marketListings: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError('NFT not found');
    }

    // Check if NFT has more than 1 transaction (more than just the mint)
    if (existing._count.transactions > 1) {
      throw new ValidationError(
        `Cannot delete NFT with ${existing._count.transactions} transactions. NFT has been traded.`
      );
    }

    // Check if NFT has active marketplace listings
    if (existing._count.marketListings > 0) {
      throw new ValidationError(
        `Cannot delete NFT with ${existing._count.marketListings} marketplace listings.`
      );
    }

    await prisma.nFT.delete({ where: { id } });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'NFT_DELETE',
        description: `nftId: ${id}, name: ${existing.name}`,
        entityType: 'nft',
        entityId: 0,
      },
    });

    logger.info('NFT deleted', { nftId: id, adminId });

    return res.json({ success: true, message: 'NFT deleted' });
  })
);

/**
 * POST /admin/nft/:id/transfer
 * Admin transfer NFT to another user
 */
router.post(
  '/:id/transfer',
  validateBody(AdminTransferNFTSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminTransferNFTInput;

    const nft = await prisma.nFT.findUnique({ where: { id } });
    if (!nft) {
      throw new NotFoundError('NFT not found');
    }

    if (!nft.isTransferable) {
      throw new ValidationError('This NFT is not transferable');
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: body.toUserId },
    });
    if (!targetUser) {
      throw new NotFoundError('Target user not found');
    }

    // Transfer NFT in transaction
    await prisma.$transaction(async (tx) => {
      // Update NFT owner
      await tx.nFT.update({
        where: { id },
        data: { currentOwnerId: body.toUserId },
      });

      // Create transfer transaction
      await tx.nFTTransaction.create({
        data: {
          nftId: id,
          fromUserId: nft.currentOwnerId,
          toUserId: body.toUserId,
          transactionType: 'TRANSFER',
          price: null,
        },
      });
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'NFT_TRANSFER',
        description: `nftId: ${id}, from: ${nft.currentOwnerId || 'system'}, to: ${body.toUserId}, reason: ${body.reason || 'admin transfer'}`,
        entityType: 'nft',
        entityId: 0,
      },
    });

    logger.info('NFT transferred by admin', {
      nftId: id,
      fromUserId: nft.currentOwnerId,
      toUserId: body.toUserId,
      adminId,
    });

    return res.json({ success: true, message: 'NFT transferred successfully' });
  })
);

// ==================== NFT Transactions ====================

/**
 * GET /admin/nft/transactions
 * List NFT transactions
 */
router.get(
  '/transactions',
  validateQuery(AdminNFTTransactionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      nftId?: string;
      fromUserId?: string;
      toUserId?: string;
      transactionType?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.nftId) where.nftId = q.nftId;
    if (q.fromUserId) where.fromUserId = q.fromUserId;
    if (q.toUserId) where.toUserId = q.toUserId;
    if (q.transactionType) where.transactionType = q.transactionType;

    const [transactions, total] = await Promise.all([
      prisma.nFTTransaction.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          nft: {
            select: {
              id: true,
              name: true,
            },
          },
          fromUser: {
            select: {
              id: true,
              profile: { select: { userName: true } },
            },
          },
          toUser: {
            select: {
              id: true,
              profile: { select: { userName: true } },
            },
          },
        },
      }),
      prisma.nFTTransaction.count({ where }),
    ]);

    const data: AdminNFTTransactionListItem[] = transactions.map((tx) => ({
      id: tx.id,
      nftId: tx.nftId,
      nftName: tx.nft.name,
      fromUserId: tx.fromUserId,
      fromUsername: tx.fromUser?.profile?.userName || null,
      toUserId: tx.toUserId,
      toUsername: tx.toUser.profile?.userName || null,
      transactionType: tx.transactionType,
      price: tx.price,
      transactionHash: tx.transactionHash,
      createdAt: tx.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

// ==================== NFT Marketplace ====================

/**
 * GET /admin/nft/marketplace/listings
 * List marketplace listings
 */
router.get(
  '/marketplace/listings',
  validateQuery(AdminNFTMarketListingsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      nftId?: string;
      listedByUserId?: string;
      status?: string;
      minPrice?: number;
      maxPrice?: number;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.nftId) where.nftId = q.nftId;
    if (q.listedByUserId) where.listedByUserId = q.listedByUserId;
    if (q.status) where.status = q.status;
    if (q.minPrice !== undefined || q.maxPrice !== undefined) {
      where.price = {};
      if (q.minPrice !== undefined) {
        (where.price as Record<string, unknown>).gte = q.minPrice;
      }
      if (q.maxPrice !== undefined) {
        (where.price as Record<string, unknown>).lte = q.maxPrice;
      }
    }

    const [listings, total] = await Promise.all([
      prisma.nFTMarketListing.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          nft: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
          listedByUser: {
            select: {
              id: true,
              profile: { select: { userName: true } },
            },
          },
        },
      }),
      prisma.nFTMarketListing.count({ where }),
    ]);

    const data: AdminNFTMarketListingListItem[] = listings.map((listing) => ({
      id: listing.id,
      nftId: listing.nftId,
      nftName: listing.nft.name,
      nftImageUrl: listing.nft.imageUrl,
      listedByUserId: listing.listedByUserId,
      listedByUsername: listing.listedByUser.profile?.userName || null,
      price: listing.price,
      status: listing.status,
      listedAt: listing.listedAt.toISOString(),
      createdAt: listing.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * PATCH /admin/nft/marketplace/listings/:id
 * Moderate marketplace listing (cancel suspicious listings)
 */
router.patch(
  '/marketplace/listings/:id',
  validateBody(AdminModerateListingSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminModerateListingInput;

    const existing = await prisma.nFTMarketListing.findUnique({
      where: { id },
      include: {
        nft: { select: { name: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError('Marketplace listing not found');
    }

    const listing = await prisma.nFTMarketListing.update({
      where: { id },
      data: { status: body.status },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'NFT_LISTING_UPDATE',
        description: `listingId: ${listing.id}, nftName: ${existing.nft.name}, status: ${body.status}, note: ${body.moderatorNote || 'none'}`,
        entityType: 'nft_market_listing',
        entityId: 0,
      },
    });

    logger.info('NFT marketplace listing moderated', {
      listingId: listing.id,
      status: body.status,
      adminId,
    });

    return res.json({ success: true, data: listing });
  })
);

// ==================== Lootbox ====================

/**
 * GET /admin/nft/lootbox/stats
 * Get lootbox statistics
 */
router.get(
  '/lootbox/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const total = await prisma.lootbox.count();

    const locked = await prisma.lootbox.count({
      where: { status: 'LOCKED' },
    });

    const unlocked = await prisma.lootbox.count({
      where: { status: 'UNLOCKED' },
    });

    // Total tips locked
    const totalTipsResult = await prisma.lootbox.aggregate({
      _sum: { tipsLocked: true },
      where: { status: 'LOCKED' },
    });

    const totalTipsLocked = totalTipsResult._sum.tipsLocked || 0;

    // Average tips per lootbox
    const avgTipsResult = await prisma.lootbox.aggregate({
      _avg: { tipsLocked: true },
    });

    const avgTipsPerLootbox = avgTipsResult._avg.tipsLocked || 0;

    const data: AdminLootboxStatsResponse = {
      total,
      locked,
      unlocked,
      totalTipsLocked,
      avgTipsPerLootbox: Math.round(avgTipsPerLootbox * 100) / 100,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/nft/lootbox
 * List lootboxes
 */
router.get(
  '/lootbox',
  validateQuery(AdminLootboxQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      userId?: string;
      status?: string;
      minTipsLocked?: number;
      maxTipsLocked?: number;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.userId) where.userId = q.userId;
    if (q.status) where.status = q.status;
    if (q.minTipsLocked !== undefined || q.maxTipsLocked !== undefined) {
      where.tipsLocked = {};
      if (q.minTipsLocked !== undefined) {
        (where.tipsLocked as Record<string, unknown>).gte = q.minTipsLocked;
      }
      if (q.maxTipsLocked !== undefined) {
        (where.tipsLocked as Record<string, unknown>).lte = q.maxTipsLocked;
      }
    }

    const [lootboxes, total] = await Promise.all([
      prisma.lootbox.findMany({
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
        },
      }),
      prisma.lootbox.count({ where }),
    ]);

    const data: AdminLootboxListItem[] = lootboxes.map((box) => ({
      id: box.id,
      userId: box.userId,
      userEmail: box.user.email,
      username: box.user.profile?.userName || null,
      tipsLocked: box.tipsLocked,
      status: box.status,
      createdAt: box.createdAt.toISOString(),
      updatedAt: box.updatedAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * POST /admin/nft/lootbox/:id/unlock
 * Admin unlock lootbox
 */
router.post(
  '/lootbox/:id/unlock',
  validateBody(AdminUnlockLootboxSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminUnlockLootboxInput;

    const lootbox = await prisma.lootbox.findUnique({
      where: { id },
    });

    if (!lootbox) {
      throw new NotFoundError('Lootbox not found');
    }

    if (lootbox.status !== 'LOCKED') {
      throw new ValidationError('Lootbox is not locked');
    }

    // Unlock lootbox
    const updatedLootbox = await prisma.lootbox.update({
      where: { id },
      data: { status: 'UNLOCKED' },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'LOOTBOX_UNLOCK',
        description: `lootboxId: ${id}, userId: ${lootbox.userId}, tipsLocked: ${lootbox.tipsLocked}, note: ${body.adminNote || 'admin unlock'}`,
        entityType: 'lootbox',
        entityId: 0,
      },
    });

    logger.info('Lootbox unlocked by admin', {
      lootboxId: id,
      userId: lootbox.userId,
      adminId,
    });

    return res.json({ success: true, data: updatedLootbox });
  })
);

/**
 * DELETE /admin/nft/lootbox/:id/cancel
 * Cancel/delete lootbox
 */
router.delete(
  '/lootbox/:id/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;

    const lootbox = await prisma.lootbox.findUnique({
      where: { id },
    });

    if (!lootbox) {
      throw new NotFoundError('Lootbox not found');
    }

    if (lootbox.status === 'UNLOCKED') {
      throw new ValidationError('Cannot cancel already unlocked lootbox');
    }

    // Delete lootbox (this should refund tips to user in production)
    await prisma.lootbox.delete({ where: { id } });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'LOOTBOX_CANCEL',
        description: `lootboxId: ${id}, userId: ${lootbox.userId}, tipsLocked: ${lootbox.tipsLocked}`,
        entityType: 'lootbox',
        entityId: 0,
      },
    });

    logger.info('Lootbox cancelled by admin', {
      lootboxId: id,
      userId: lootbox.userId,
      tipsLocked: lootbox.tipsLocked,
      adminId,
    });

    return res.json({ success: true, message: 'Lootbox cancelled' });
  })
);

// ==================== Stats Endpoints ====================

/**
 * @swagger
 * /api/admin/nft/marketplace/stats:
 *   get:
 *     tags: [Admin - NFT]
 *     summary: Get NFT marketplace statistics
 *     responses:
 *       200:
 *         description: NFT marketplace stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalListings:
 *                       type: number
 *                     active:
 *                       type: number
 *                     sold:
 *                       type: number
 */
router.get(
  '/marketplace/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [totalListings, active, sold] = await Promise.all([
      prisma.nFTMarketListing.count(),
      prisma.nFTMarketListing.count({
        where: { status: 'ACTIVE' },
      }),
      prisma.nFTMarketListing.count({
        where: { status: 'SOLD' },
      }),
    ]);

    const data = {
      totalListings,
      active,
      sold,
    };

    return res.json({ success: true, data });
  })
);

export default router;
