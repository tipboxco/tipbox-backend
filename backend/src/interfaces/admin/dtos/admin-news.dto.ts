/* ========== News ========== */

export type AdminNewsStatsResponse = {
  total: number;
  totalViewsThisMonth: number;
  mostPopular: {
    newsId: string;
    title: string;
    viewsCount: number;
  }[];
  avgComments: number;
};

export type AdminNewsListItem = {
  id: string;
  brandId: string;
  brandName: string;
  title: string;
  content: string;
  bannerImageUrl: string | null;
  source: string;
  author: string | null;
  tags: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  createdAt: string;
};

export type AdminNewsDetailResponse = AdminNewsListItem & {
  updatedAt: string;
  brand: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
  recentComments: {
    id: string;
    userId: string;
    username: string | null;
    comment: string;
    createdAt: string;
  }[];
};

/* ========== News Comments ========== */

export type AdminNewsCommentListItem = {
  id: string;
  newsId: string;
  newsTitle: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  comment: string;
  likesCount: number;
  createdAt: string;
};

export type AdminNewsCommentDetailResponse = AdminNewsCommentListItem & {
  updatedAt: string;
  news: {
    id: string;
    title: string;
  };
  user: {
    id: string;
    email: string | null;
    username: string | null;
  };
};

/* ========== News Analytics ========== */

export type AdminNewsAnalyticsResponse = {
  topNewsByViews: {
    newsId: string;
    title: string;
    viewsCount: number;
  }[];
  topNewsByEngagement: {
    newsId: string;
    title: string;
    engagementScore: number; // likes + comments + shares
  }[];
  brandPerformance: {
    brandId: string;
    brandName: string;
    newsCount: number;
    totalViews: number;
    avgEngagement: number;
  }[];
};

/* ========== Input Types (inferred from schemas) ========== */

import type {
  AdminCreateNewsSchema,
  AdminUpdateNewsSchema,
} from '../schemas/admin-news.schemas';
import type { z } from 'zod';

export type AdminCreateNewsInput = z.infer<typeof AdminCreateNewsSchema>;
export type AdminUpdateNewsInput = z.infer<typeof AdminUpdateNewsSchema>;
