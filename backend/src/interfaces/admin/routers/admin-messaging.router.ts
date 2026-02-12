import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError, ValidationError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';

// Import schemas
import {
  AdminDMThreadsQuerySchema,
  AdminDMMessagesQuerySchema,
  AdminCloseThreadSchema,
  AdminSupportRequestsQuerySchema,
  AdminAssignSupportRequestSchema,
  AdminCloseSupportRequestSchema,
  AdminReplySupportRequestSchema,
} from '../schemas/admin-messaging.schemas';

// Import DTOs
import type {
  AdminDMStatsResponse,
  AdminDMThreadListItem,
  AdminDMThreadDetailResponse,
  AdminDMMessageListItem,
  AdminSupportStatsResponse,
  AdminSupportRequestListItem,
  AdminSupportRequestDetailResponse,
  AdminCloseThreadInput,
  AdminAssignSupportRequestInput,
  AdminCloseSupportRequestInput,
  AdminReplySupportRequestInput,
} from '../dtos/admin-messaging.dto';

import type { PaginationMeta } from '../dtos/admin-common.dto';

const router = Router();
const prisma = getPrisma();

/**
 * Communication & Messaging Management Router
 * Routes are mounted at /admin/messaging
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Direct Messaging ====================

/**
 * GET /admin/messaging/stats
 * Get messaging statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const totalThreads = await prisma.dMThread.count();

    const activeThreads = await prisma.dMThread.count({
      where: { isActive: true },
    });

    const totalMessages = await prisma.dMMessage.count();

    const supportThreads = await prisma.dMThread.count({
      where: { isSupportThread: true },
    });

    // Messages this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const messagesThisMonth = await prisma.dMMessage.count({
      where: { sentAt: { gte: startOfMonth } },
    });

    const data: AdminDMStatsResponse = {
      totalThreads,
      activeThreads,
      totalMessages,
      supportThreads,
      messagesThisMonth,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/messaging/threads
 * List DM threads with pagination and filters
 */
router.get(
  '/threads',
  validateQuery(AdminDMThreadsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      userOneId?: string;
      userTwoId?: string;
      isActive?: boolean;
      isSupportThread?: boolean;
      search?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.userOneId) {
      where.OR = [{ userOneId: q.userOneId }, { userTwoId: q.userOneId }];
    }
    if (q.userTwoId && !q.userOneId) {
      where.OR = [{ userOneId: q.userTwoId }, { userTwoId: q.userTwoId }];
    }
    if (q.isActive !== undefined) where.isActive = q.isActive;
    if (q.isSupportThread !== undefined) where.isSupportThread = q.isSupportThread;

    const [threads, total] = await Promise.all([
      prisma.dMThread.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          userOne: {
            select: {
              id: true,
              profile: { select: { userName: true } },
            },
          },
          userTwo: {
            select: {
              id: true,
              profile: { select: { userName: true } },
            },
          },
          _count: {
            select: { messages: true },
          },
        },
      }),
      prisma.dMThread.count({ where }),
    ]);

    const data: AdminDMThreadListItem[] = threads.map((thread) => ({
      id: thread.id,
      userOneId: thread.userOneId,
      userOneUsername: thread.userOne.profile?.userName || null,
      userTwoId: thread.userTwoId,
      userTwoUsername: thread.userTwo.profile?.userName || null,
      isActive: thread.isActive,
      isSupportThread: thread.isSupportThread,
      messageCount: thread._count.messages,
      lastMessageAt: thread.lastMessageAt?.toISOString() || null,
      startedAt: thread.startedAt.toISOString(),
      createdAt: thread.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/messaging/threads/:id
 * Get thread details
 */
router.get(
  '/threads/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const thread = await prisma.dMThread.findUnique({
      where: { id },
      include: {
        userOne: {
          select: {
            id: true,
            email: true,
            profile: { select: { userName: true } },
          },
        },
        userTwo: {
          select: {
            id: true,
            email: true,
            profile: { select: { userName: true } },
          },
        },
        messages: {
          take: 20,
          orderBy: { sentAt: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                profile: { select: { userName: true } },
              },
            },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    if (!thread) {
      throw new NotFoundError('Thread not found');
    }

    const data: AdminDMThreadDetailResponse = {
      id: thread.id,
      userOneId: thread.userOneId,
      userOneUsername: thread.userOne.profile?.userName || null,
      userTwoId: thread.userTwoId,
      userTwoUsername: thread.userTwo.profile?.userName || null,
      isActive: thread.isActive,
      isSupportThread: thread.isSupportThread,
      messageCount: thread._count.messages,
      lastMessageAt: thread.lastMessageAt?.toISOString() || null,
      startedAt: thread.startedAt.toISOString(),
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      unreadCountUserOne: thread.unreadCountUserOne,
      unreadCountUserTwo: thread.unreadCountUserTwo,
      userOne: {
        id: thread.userOne.id,
        email: thread.userOne.email,
        username: thread.userOne.profile?.userName || null,
      },
      userTwo: {
        id: thread.userTwo.id,
        email: thread.userTwo.email,
        username: thread.userTwo.profile?.userName || null,
      },
      recentMessages: thread.messages.map((msg) => ({
        id: msg.id,
        senderId: msg.senderId,
        senderUsername: msg.sender.profile?.userName || null,
        message: msg.message,
        sentAt: msg.sentAt.toISOString(),
        isRead: msg.isRead,
      })),
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/messaging/messages
 * List all messages (for moderation)
 */
router.get(
  '/messages',
  validateQuery(AdminDMMessagesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      threadId?: string;
      senderId?: string;
      search?: string;
      context?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.threadId) where.threadId = q.threadId;
    if (q.senderId) where.senderId = q.senderId;
    if (q.context) where.context = q.context;
    if (q.search) {
      where.OR = [
        { message: { contains: q.search, mode: 'insensitive' } },
        { caption: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [messages, total] = await Promise.all([
      prisma.dMMessage.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          sender: {
            select: {
              id: true,
              profile: { select: { userName: true } },
            },
          },
        },
      }),
      prisma.dMMessage.count({ where }),
    ]);

    const data: AdminDMMessageListItem[] = messages.map((msg) => ({
      id: msg.id,
      threadId: msg.threadId,
      senderId: msg.senderId,
      senderUsername: msg.sender.profile?.userName || null,
      message: msg.message,
      context: msg.context,
      isRead: msg.isRead,
      mediaUrl: msg.mediaUrl,
      sentAt: msg.sentAt.toISOString(),
      createdAt: msg.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * DELETE /admin/messaging/messages/:id
 * Delete message (moderation)
 */
router.delete(
  '/messages/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;

    const existing = await prisma.dMMessage.findUnique({
      where: { id },
      include: {
        thread: { select: { id: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError('Message not found');
    }

    await prisma.dMMessage.delete({ where: { id } });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'DM_MESSAGE_DELETE',
        description: `messageId: ${id}, threadId: ${existing.threadId}, senderId: ${existing.senderId}`,
        entityType: 'dm_message',
        entityId: 0,
      },
    });

    logger.info('DM message deleted', { messageId: id, adminId });

    return res.json({ success: true, message: 'Message deleted' });
  })
);

/**
 * PATCH /admin/messaging/threads/:id/close
 * Close thread
 */
router.patch(
  '/threads/:id/close',
  validateBody(AdminCloseThreadSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminCloseThreadInput;

    const existing = await prisma.dMThread.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Thread not found');
    }

    const thread = await prisma.dMThread.update({
      where: { id },
      data: { isActive: false },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'DM_THREAD_CLOSE',
        description: `threadId: ${id}, reason: ${body.reason || 'admin action'}`,
        entityType: 'dm_thread',
        entityId: 0,
      },
    });

    logger.info('DM thread closed', { threadId: id, adminId });

    return res.json({ success: true, data: thread });
  })
);

// ==================== Support Requests ====================

/**
 * GET /admin/messaging/support/stats
 * Get support requests statistics
 */
router.get(
  '/support/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const total = await prisma.dMRequest.count();

    const pending = await prisma.dMRequest.count({
      where: { status: 'PENDING' },
    });

    const accepted = await prisma.dMRequest.count({
      where: { status: 'ACCEPTED' },
    });

    const completed = await prisma.dMRequest.count({
      where: { status: 'COMPLETED' },
    });

    // Resolved this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const resolvedThisMonth = await prisma.dMRequest.count({
      where: {
        status: 'COMPLETED',
        respondedAt: { gte: startOfMonth },
      },
    });

    // Average response time (in hours)
    const respondedRequests = await prisma.dMRequest.findMany({
      where: {
        respondedAt: { not: null },
      },
      select: {
        sentAt: true,
        respondedAt: true,
      },
    });

    let totalResponseTime = 0;
    respondedRequests.forEach((req) => {
      if (req.respondedAt) {
        const diff = req.respondedAt.getTime() - req.sentAt.getTime();
        totalResponseTime += diff;
      }
    });

    const avgResponseTime =
      respondedRequests.length > 0
        ? totalResponseTime / respondedRequests.length / (1000 * 60 * 60)
        : 0;

    const data: AdminSupportStatsResponse = {
      total,
      pending,
      accepted,
      completed,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      resolvedThisMonth,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/messaging/support/requests
 * List support requests
 */
router.get(
  '/support/requests',
  validateQuery(AdminSupportRequestsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      fromUserId?: string;
      toUserId?: string;
      status?: string;
      type?: string;
      search?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.fromUserId) where.fromUserId = q.fromUserId;
    if (q.toUserId) where.toUserId = q.toUserId;
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;
    if (q.search) {
      where.description = { contains: q.search, mode: 'insensitive' };
    }

    const [requests, total] = await Promise.all([
      prisma.dMRequest.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
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
      }),
      prisma.dMRequest.count({ where }),
    ]);

    const data: AdminSupportRequestListItem[] = requests.map((req) => ({
      id: req.id,
      fromUserId: req.fromUserId,
      fromUsername: req.fromUser.profile?.userName || null,
      toUserId: req.toUserId,
      toUsername: req.toUser.profile?.userName || null,
      status: req.status,
      type: req.type,
      description: req.description,
      amount: req.amount,
      threadId: req.threadId,
      sentAt: req.sentAt.toISOString(),
      respondedAt: req.respondedAt?.toISOString() || null,
      createdAt: req.createdAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/messaging/support/requests/:id
 * Get support request details
 */
router.get(
  '/support/requests/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const request = await prisma.dMRequest.findUnique({
      where: { id },
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
        thread: {
          select: {
            id: true,
            isActive: true,
            _count: { select: { messages: true } },
          },
        },
        reports: {
          include: {
            reporter: {
              select: {
                id: true,
                profile: { select: { userName: true } },
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundError('Support request not found');
    }

    const data: AdminSupportRequestDetailResponse = {
      id: request.id,
      fromUserId: request.fromUserId,
      fromUsername: request.fromUser.profile?.userName || null,
      toUserId: request.toUserId,
      toUsername: request.toUser.profile?.userName || null,
      status: request.status,
      type: request.type,
      description: request.description,
      amount: request.amount,
      threadId: request.threadId,
      sentAt: request.sentAt.toISOString(),
      respondedAt: request.respondedAt?.toISOString() || null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      fromUserRating: request.fromUserRating,
      toUserRating: request.toUserRating,
      closedByFromUserAt: request.closedByFromUserAt?.toISOString() || null,
      closedByToUserAt: request.closedByToUserAt?.toISOString() || null,
      fromUser: {
        id: request.fromUser.id,
        email: request.fromUser.email,
        username: request.fromUser.profile?.userName || null,
      },
      toUser: {
        id: request.toUser.id,
        email: request.toUser.email,
        username: request.toUser.profile?.userName || null,
      },
      thread: request.thread
        ? {
            id: request.thread.id,
            isActive: request.thread.isActive,
            messageCount: request.thread._count.messages,
          }
        : null,
      reports: request.reports.map((report) => ({
        id: report.id,
        reporterId: report.reporterId,
        reporterUsername: report.reporter.profile?.userName || null,
        category: report.category,
        description: report.description,
        createdAt: report.createdAt.toISOString(),
      })),
    };

    return res.json({ success: true, data });
  })
);

/**
 * PATCH /admin/messaging/support/requests/:id/assign
 * Assign support request to admin/user
 */
router.patch(
  '/support/requests/:id/assign',
  validateBody(AdminAssignSupportRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminAssignSupportRequestInput;

    const existing = await prisma.dMRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Support request not found');
    }

    // Update toUserId to the assigned user
    const request = await prisma.dMRequest.update({
      where: { id },
      data: {
        toUserId: body.assignedToUserId,
        status: 'ACCEPTED',
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'SUPPORT_REQUEST_ASSIGN',
        description: `requestId: ${id}, assignedTo: ${body.assignedToUserId}, note: ${body.note || 'none'}`,
        entityType: 'dm_request',
        entityId: 0,
      },
    });

    logger.info('Support request assigned', {
      requestId: id,
      assignedTo: body.assignedToUserId,
      adminId,
    });

    return res.json({ success: true, data: request });
  })
);

/**
 * PATCH /admin/messaging/support/requests/:id/close
 * Close support request
 */
router.patch(
  '/support/requests/:id/close',
  validateBody(AdminCloseSupportRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminCloseSupportRequestInput;

    const existing = await prisma.dMRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Support request not found');
    }

    const request = await prisma.dMRequest.update({
      where: { id },
      data: {
        status: body.status,
        respondedAt: new Date(),
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'SUPPORT_REQUEST_CLOSE',
        description: `requestId: ${id}, status: ${body.status}, resolution: ${body.resolution}`,
        entityType: 'dm_request',
        entityId: 0,
      },
    });

    logger.info('Support request closed', {
      requestId: id,
      status: body.status,
      adminId,
    });

    return res.json({ success: true, data: request });
  })
);

/**
 * POST /admin/messaging/support/requests/:id/reply
 * Reply to support request (sends a DM)
 */
router.post(
  '/support/requests/:id/reply',
  validateBody(AdminReplySupportRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminReplySupportRequestInput;

    const request = await prisma.dMRequest.findUnique({
      where: { id },
      include: { thread: true },
    });

    if (!request) {
      throw new NotFoundError('Support request not found');
    }

    // If no thread exists, create one
    let threadId = request.threadId;
    if (!threadId) {
      const newThread = await prisma.dMThread.create({
        data: {
          userOneId: request.fromUserId,
          userTwoId: adminId,
          isActive: true,
          isSupportThread: true,
        },
      });
      threadId = newThread.id;

      // Update request with thread
      await prisma.dMRequest.update({
        where: { id },
        data: { threadId: newThread.id },
      });
    }

    // Send message
    const message = await prisma.dMMessage.create({
      data: {
        threadId,
        senderId: adminId,
        message: body.message,
        isRead: false,
        context: 'SUPPORT',
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'SUPPORT_SESSION_JOIN',
        description: `requestId: ${id}, messageId: ${message.id}`,
        entityType: 'dm_request',
        entityId: 0,
      },
    });

    logger.info('Admin replied to support request', {
      requestId: id,
      messageId: message.id,
      adminId,
    });

    return res.json({ success: true, data: message });
  })
);

// ==================== Stats Endpoints ====================

/**
 * @swagger
 * /admin/messaging/notifications/stats:
 *   get:
 *     tags: [Admin - Messaging]
 *     summary: Get notifications statistics
 *     responses:
 *       200:
 *         description: Notifications stats
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
 *                     total:
 *                       type: number
 *                     sent:
 *                       type: number
 *                     delivered:
 *                       type: number
 */
router.get(
  '/notifications/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, sent, delivered] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({
        where: { sentAt: { not: null } },
      }),
      prisma.notification.count({
        where: { read: true },
      }),
    ]);

    const data = {
      total,
      sent,
      delivered,
    };

    return res.json({ success: true, data });
  })
);

/**
 * @swagger
 * /admin/messaging/direct-messages/stats:
 *   get:
 *     tags: [Admin - Messaging]
 *     summary: Get direct messages statistics
 *     responses:
 *       200:
 *         description: Direct messages stats
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
 *                     total:
 *                       type: number
 *                     thisWeek:
 *                       type: number
 */
router.get(
  '/direct-messages/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    // Count this week's messages
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total, thisWeek] = await Promise.all([
      prisma.dMMessage.count(),
      prisma.dMMessage.count({
        where: {
          createdAt: { gte: oneWeekAgo },
        },
      }),
    ]);

    const data = {
      total,
      thisWeek,
    };

    return res.json({ success: true, data });
  })
);

export default router;
