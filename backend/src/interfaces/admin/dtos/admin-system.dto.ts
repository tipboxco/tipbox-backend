/* ========== Action Types ========== */

export type AdminActionTypeListItem = {
  id: string;
  mainAction: string;
  code: string;
  label: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

/* ========== System Configuration ========== */

export type AdminSystemConfigResponse = {
  configs: {
    key: string;
    value: string;
    description: string | null;
  }[];
};

/* ========== System Health ========== */

export type AdminSystemHealthResponse = {
  status: 'healthy' | 'degraded' | 'down';
  uptime: number; // seconds
  database: {
    status: 'connected' | 'disconnected';
    responseTime: number; // ms
  };
  redis: {
    status: 'connected' | 'disconnected';
    responseTime: number; // ms
  };
  timestamp: string;
};

/* ========== System Metrics ========== */

export type AdminSystemMetricsResponse = {
  users: {
    total: number;
    active: number; // active in last 30 days
    newToday: number;
  };
  content: {
    totalPosts: number;
    postsToday: number;
    totalComments: number;
  };
  transactions: {
    totalVolume: number;
    transactionsToday: number;
  };
  performance: {
    avgResponseTime: number; // ms
    requestCount: number;
  };
};

/* ========== Input Types (inferred from schemas) ========== */

import type {
  AdminCreateActionTypeSchema,
  AdminUpdateActionTypeSchema,
  AdminUpdateSystemConfigSchema,
} from '../schemas/admin-system.schemas';
import type { z } from 'zod';

export type AdminCreateActionTypeInput = z.infer<typeof AdminCreateActionTypeSchema>;
export type AdminUpdateActionTypeInput = z.infer<typeof AdminUpdateActionTypeSchema>;
export type AdminUpdateSystemConfigInput = z.infer<typeof AdminUpdateSystemConfigSchema>;
