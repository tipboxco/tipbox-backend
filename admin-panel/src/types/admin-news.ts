// ==================== News Types ====================

export type AdminNewsStatsResponse = {
  total: number;
  viewsThisMonth: number;
  avgComments: number;
  mostPopularBrand?: {
    brandId: string;
    brandName: string;
    articleCount: number;
  };
};

export type AdminNewsListItem = {
  id: string;
  brandId: string;
  brandName: string | null;
  title: string;
  content: string; // Rich text/HTML
  bannerImageUrl: string | null;
  source: string;
  author: string | null;
  tags: string[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  favoriteCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminNewsDetailResponse = AdminNewsListItem & {
  recentComments?: {
    id: string;
    userId: string;
    username: string | null;
    content: string;
    createdAt: string;
  }[];
  relatedArticles?: {
    id: string;
    title: string;
    bannerImageUrl: string | null;
    viewCount: number;
    createdAt: string;
  }[];
};

export type CreateNewsInput = {
  brandId: string;
  title: string;
  content: string;
  bannerImageUrl?: string | null;
  source: string;
  author?: string | null;
  tags?: string[];
};

export type UpdateNewsInput = Partial<CreateNewsInput>;

export type AdminNewsCommentListItem = {
  id: string;
  newsId: string;
  userId: string;
  username: string | null;
  userEmail: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type NewsQueryParams = {
  limit?: number;
  offset?: number;
  brandId?: string;
  source?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
};
