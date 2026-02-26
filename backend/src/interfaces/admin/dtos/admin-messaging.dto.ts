/* ========== Direct Messaging ========== */

export type AdminDMStatsResponse = {
  totalThreads: number;
  activeThreads: number;
  totalMessages: number;
  supportThreads: number;
  messagesThisMonth: number;
};

export type AdminDMThreadListItem = {
  id: string;
  userOneId: string;
  userOneUsername: string | null;
  userTwoId: string;
  userTwoUsername: string | null;
  isActive: boolean;
  isSupportThread: boolean;
  messageCount: number;
  lastMessageAt: string | null;
  startedAt: string;
  createdAt: string;
};

export type AdminDMThreadDetailResponse = AdminDMThreadListItem & {
  updatedAt: string;
  unreadCountUserOne: number;
  unreadCountUserTwo: number;
  userOne: {
    id: string;
    email: string | null;
    username: string | null;
  };
  userTwo: {
    id: string;
    email: string | null;
    username: string | null;
  };
  recentMessages: {
    id: string;
    senderId: string;
    senderUsername: string | null;
    message: string;
    sentAt: string;
    isRead: boolean;
  }[];
};

export type AdminDMMessageListItem = {
  id: string;
  threadId: string;
  senderId: string;
  senderUsername: string | null;
  message: string;
  context: string;
  isRead: boolean;
  mediaUrl: string | null;
  sentAt: string;
  createdAt: string;
};

/* ========== Support Requests ========== */

export type AdminSupportStatsResponse = {
  total: number;
  pending: number;
  accepted: number;
  completed: number;
  avgResponseTime: number; // in hours
  resolvedThisMonth: number;
};

export type AdminSupportRequestListItem = {
  id: string;
  fromUserId: string;
  fromUsername: string | null;
  toUserId: string;
  toUsername: string | null;
  status: string;
  type: string;
  description: string | null;
  amount: number;
  threadId: string | null;
  sentAt: string;
  respondedAt: string | null;
  createdAt: string;
};

export type AdminSupportRequestDetailResponse = AdminSupportRequestListItem & {
  updatedAt: string;
  fromUserRating: number | null;
  toUserRating: number | null;
  closedByFromUserAt: string | null;
  closedByToUserAt: string | null;
  fromUser: {
    id: string;
    email: string | null;
    username: string | null;
  };
  toUser: {
    id: string;
    email: string | null;
    username: string | null;
  };
  thread: {
    id: string;
    isActive: boolean;
    messageCount: number;
  } | null;
  reports: {
    id: string;
    reporterId: string;
    reporterUsername: string | null;
    category: string;
    description: string | null;
    createdAt: string;
  }[];
};

/* ========== Input Types (inferred from schemas) ========== */

import type {
  AdminCloseThreadSchema,
  AdminAssignSupportRequestSchema,
  AdminCloseSupportRequestSchema,
  AdminReplySupportRequestSchema,
} from '../schemas/admin-messaging.schemas';
import type { z } from 'zod';

export type AdminCloseThreadInput = z.infer<typeof AdminCloseThreadSchema>;
export type AdminAssignSupportRequestInput = z.infer<typeof AdminAssignSupportRequestSchema>;
export type AdminCloseSupportRequestInput = z.infer<typeof AdminCloseSupportRequestSchema>;
export type AdminReplySupportRequestInput = z.infer<typeof AdminReplySupportRequestSchema>;
