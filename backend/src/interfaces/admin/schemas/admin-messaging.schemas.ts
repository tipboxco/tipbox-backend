import { z } from 'zod';

/* ========== Direct Messaging ========== */

export const AdminDMThreadsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  userOneId: z.string().uuid().optional(),
  userTwoId: z.string().uuid().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  isSupportThread: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'lastMessageAt']).default('lastMessageAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminDMMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  threadId: z.string().uuid().optional(),
  senderId: z.string().uuid().optional(),
  search: z.string().optional(),
  context: z.enum(['DM', 'SUPPORT', 'GROUP']).optional(),
  sort: z.enum(['createdAt', 'sentAt']).default('sentAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminCloseThreadSchema = z.object({
  reason: z.string().max(500).optional(),
});

/* ========== Support Requests ========== */

export const AdminSupportRequestsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  fromUserId: z.string().uuid().optional(),
  toUserId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED']).optional(),
  type: z
    .enum(['GENERAL', 'TECHNICAL', 'PAYMENT', 'ACCOUNT', 'CONTENT'])
    .optional(),
  search: z.string().optional(),
  sort: z.enum(['createdAt', 'sentAt', 'respondedAt']).default('sentAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminAssignSupportRequestSchema = z.object({
  assignedToUserId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export const AdminCloseSupportRequestSchema = z.object({
  resolution: z.string().max(1000),
  status: z.enum(['COMPLETED', 'REJECTED']),
});

export const AdminReplySupportRequestSchema = z.object({
  message: z.string().min(1).max(5000),
});
