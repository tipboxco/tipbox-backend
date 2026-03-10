import { get, post, patch, del } from './client';
import type { ApiResponse } from './client';

// ==================== Type Interfaces ====================

/* ========== Notifications ========== */

export type AdminNotificationStatsResponse = {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  readRate: number;
  byType: Record<string, number>;
};

export type AdminNotificationListItem = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  username: string | null;
  type: string;
  title: string;
  message: string;
  status: string;
  isRead: boolean;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type AdminNotificationDetailResponse = AdminNotificationListItem & {
  updatedAt: string;
  metadata: Record<string, unknown> | null;
};

export type SendNotificationInput = {
  userId?: string | null;
  type: string;
  title: string;
  message: string;
  broadcast?: boolean;
  metadata?: Record<string, unknown>;
};

/* ========== Direct Messages ========== */

export type AdminDirectMessageStatsResponse = {
  totalThreads: number;
  totalMessages: number;
  activeThreads: number;
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
  userOne: { id: string; email: string; username: string | null };
  userTwo: { id: string; email: string; username: string | null };
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
  senderEmail: string | null;
  senderUsername: string | null;
  message: string;
  isRead: boolean;
  isFlagged: boolean;
  createdAt: string;
};

/* ========== Support Requests ========== */

export type AdminSupportRequestStatsResponse = {
  total: number;
  open: number;
  resolved: number;
  thisWeek: number;
  avgResolutionTime: number;
};

export type AdminSupportRequestListItem = {
  id: string;
  requesterId: string;
  requesterEmail: string | null;
  requesterUsername: string | null;
  helperId: string | null;
  helperEmail: string | null;
  helperUsername: string | null;
  type: string;
  amount: number | null;
  status: string;
  rating: number | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type AdminSupportRequestDetailResponse = AdminSupportRequestListItem & {
  updatedAt: string;
  description: string | null;
  feedback: string | null;
  isReported: boolean;
  reportReason: string | null;
};

export type UpdateSupportRequestInput = {
  status?: string;
  helperId?: string | null;
};

/* ========== Expert Requests ========== */

export type AdminExpertRequestStatsResponse = {
  total: number;
  pending: number;
  broadcasting: number;
  answered: number;
  thisWeek: number;
};

export type AdminExpertRequestListItem = {
  id: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  categoryId: string | null;
  categoryName: string | null;
  amount: number;
  status: string;
  answerCount: number;
  createdAt: string;
  broadcastedAt: string | null;
};

export type AdminExpertRequestDetailResponse = AdminExpertRequestListItem & {
  updatedAt: string;
  question: string;
  answers: {
    id: string;
    userId: string;
    username: string | null;
    answer: string;
    isAccepted: boolean;
    createdAt: string;
  }[];
};

export type BroadcastExpertRequestInput = {
  categoryId?: string | null;
};

/* ========== Query Parameters ========== */

export type NotificationsQueryParams = {
  limit?: number;
  offset?: number;
  userId?: string;
  type?: string;
  status?: string;
  isRead?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type DMThreadsQueryParams = {
  limit?: number;
  offset?: number;
  userId?: string;
  isActive?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type DMMessagesQueryParams = {
  limit?: number;
  offset?: number;
  threadId?: string;
  senderId?: string;
  isFlagged?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type SupportRequestsQueryParams = {
  limit?: number;
  offset?: number;
  requesterId?: string;
  helperId?: string;
  type?: string;
  status?: string;
  isReported?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type ExpertRequestsQueryParams = {
  limit?: number;
  offset?: number;
  userId?: string;
  categoryId?: string;
  status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
};

// ==================== API Functions ====================

/* ========== Notifications ========== */

export async function fetchNotificationStats(): Promise<
  ApiResponse<AdminNotificationStatsResponse>
> {
  return get<AdminNotificationStatsResponse>('/admin/messaging/notifications/stats');
}

export async function fetchNotifications(
  params: NotificationsQueryParams = {}
): Promise<ApiResponse<AdminNotificationListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    userId: params.userId,
    type: params.type,
    status: params.status,
    isRead: params.isRead,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminNotificationListItem[]>('/admin/messaging/notifications', query);
}

export async function fetchNotification(
  id: string
): Promise<ApiResponse<AdminNotificationDetailResponse>> {
  return get<AdminNotificationDetailResponse>(`/admin/messaging/notifications/${id}`);
}

export async function sendNotification(
  data: SendNotificationInput
): Promise<ApiResponse<{ message: string; count?: number }>> {
  return post<{ message: string; count?: number }>('/admin/messaging/notifications', data);
}

export async function resendNotification(
  id: string
): Promise<ApiResponse<{ message: string }>> {
  return post<{ message: string }>(`/admin/messaging/notifications/${id}/resend`, {});
}

/* ========== Direct Messages ========== */

export async function fetchDMStats(): Promise<ApiResponse<AdminDirectMessageStatsResponse>> {
  return get<AdminDirectMessageStatsResponse>('/admin/messaging/stats');
}

export async function fetchDMThreads(
  params: DMThreadsQueryParams = {}
): Promise<ApiResponse<AdminDMThreadListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    userId: params.userId,
    isActive: params.isActive,
    sort: params.sort ?? 'lastMessageAt',
    order: params.order ?? 'desc',
  };
  return get<AdminDMThreadListItem[]>('/admin/messaging/threads', query);
}

export async function fetchDMThread(
  id: string
): Promise<ApiResponse<AdminDMThreadDetailResponse>> {
  return get<AdminDMThreadDetailResponse>(`/admin/messaging/threads/${id}`);
}

export async function deactivateDMThread(
  id: string
): Promise<ApiResponse<{ message: string }>> {
  return post<{ message: string }>(`/admin/messaging/threads/${id}/deactivate`, {});
}

export async function fetchDMMessages(
  params: DMMessagesQueryParams = {}
): Promise<ApiResponse<AdminDMMessageListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    threadId: params.threadId,
    senderId: params.senderId,
    isFlagged: params.isFlagged,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminDMMessageListItem[]>('/admin/messaging/messages', query);
}

export async function flagDMMessage(
  id: string,
  reason: string
): Promise<ApiResponse<{ message: string }>> {
  return post<{ message: string }>(`/admin/messaging/messages/${id}/flag`, {
    reason,
  });
}

export async function deleteDMMessage(id: string): Promise<ApiResponse<void>> {
  return del<void>(`/admin/messaging/messages/${id}`);
}

/* ========== Support Requests ========== */

export async function fetchSupportRequestStats(): Promise<
  ApiResponse<AdminSupportRequestStatsResponse>
> {
  return get<AdminSupportRequestStatsResponse>('/admin/messaging/support/stats');
}

export async function fetchSupportRequests(
  params: SupportRequestsQueryParams = {}
): Promise<ApiResponse<AdminSupportRequestListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    requesterId: params.requesterId,
    helperId: params.helperId,
    type: params.type,
    status: params.status,
    isReported: params.isReported,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminSupportRequestListItem[]>('/admin/messaging/support', query);
}

export async function fetchSupportRequest(
  id: string
): Promise<ApiResponse<AdminSupportRequestDetailResponse>> {
  return get<AdminSupportRequestDetailResponse>(`/admin/messaging/support/${id}`);
}

export async function updateSupportRequest(
  id: string,
  data: UpdateSupportRequestInput
): Promise<ApiResponse<AdminSupportRequestDetailResponse>> {
  return patch<AdminSupportRequestDetailResponse>(`/admin/messaging/support/${id}`, data);
}

/* ========== Expert Requests ========== */

export async function fetchExpertRequestStats(): Promise<
  ApiResponse<AdminExpertRequestStatsResponse>
> {
  return get<AdminExpertRequestStatsResponse>('/admin/messaging/experts/stats');
}

export async function fetchExpertRequests(
  params: ExpertRequestsQueryParams = {}
): Promise<ApiResponse<AdminExpertRequestListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    userId: params.userId,
    categoryId: params.categoryId,
    status: params.status,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminExpertRequestListItem[]>('/admin/messaging/experts', query);
}

export async function fetchExpertRequest(
  id: string
): Promise<ApiResponse<AdminExpertRequestDetailResponse>> {
  return get<AdminExpertRequestDetailResponse>(`/admin/messaging/experts/${id}`);
}

export async function broadcastExpertRequest(
  id: string,
  data: BroadcastExpertRequestInput = {}
): Promise<ApiResponse<{ message: string }>> {
  return post<{ message: string }>(`/admin/messaging/experts/${id}/broadcast`, data);
}

export async function closeExpertRequest(
  id: string
): Promise<ApiResponse<{ message: string }>> {
  return post<{ message: string }>(`/admin/messaging/experts/${id}/close`, {});
}

// ==================== Aliases for Backward Compatibility ====================

/* Direct Messages Aliases */
export type AdminDMThreadStatsResponse = AdminDirectMessageStatsResponse;
export const fetchDMThreadStats = fetchDMStats;
