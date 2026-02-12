/* ========== User Analytics ========== */

export type AdminUserGrowthAnalyticsResponse = {
  totalUsers: number;
  growthRate: number; // percentage
  newUsersLastMonth: number;
  activeUsersLastMonth: number;
  retentionRate: number; // percentage
  userGrowthByDay: {
    date: string;
    newUsers: number;
    activeUsers: number;
  }[];
};

/* ========== Content Analytics ========== */

export type AdminContentTrendsResponse = {
  totalPosts: number;
  postsLastMonth: number;
  totalComments: number;
  commentsLastMonth: number;
  avgEngagementRate: number; // percentage
  topContentTypes: {
    type: string;
    count: number;
    percentage: number;
  }[];
  contentByDay: {
    date: string;
    posts: number;
    comments: number;
  }[];
};

/* ========== Engagement Analytics ========== */

export type AdminEngagementMetricsResponse = {
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgPostEngagement: number;
  topEngagedUsers: {
    userId: string;
    username: string | null;
    engagementScore: number;
  }[];
  engagementTrends: {
    date: string;
    likes: number;
    comments: number;
    shares: number;
  }[];
};

/* ========== Revenue Analytics ========== */

export type AdminRevenueAnalyticsResponse = {
  totalRevenue: number;
  revenueLastMonth: number;
  revenueGrowthRate: number; // percentage
  subscriptionRevenue: number;
  nftRevenue: number;
  revenueByDay: {
    date: string;
    revenue: number;
  }[];
  topRevenueUsers: {
    userId: string;
    username: string | null;
    totalSpent: number;
  }[];
};

/* ========== Platform Health ========== */

export type AdminPlatformHealthResponse = {
  overallScore: number; // 0-100
  userActivity: {
    score: number;
    trend: 'up' | 'down' | 'stable';
  };
  contentQuality: {
    score: number;
    trend: 'up' | 'down' | 'stable';
  };
  engagement: {
    score: number;
    trend: 'up' | 'down' | 'stable';
  };
  revenue: {
    score: number;
    trend: 'up' | 'down' | 'stable';
  };
  issues: {
    severity: 'low' | 'medium' | 'high';
    message: string;
  }[];
};

/* ========== Analytics Export ========== */

export type AdminAnalyticsExportResponse = {
  exportUrl: string;
  format: string;
  generatedAt: string;
  expiresAt: string;
};
