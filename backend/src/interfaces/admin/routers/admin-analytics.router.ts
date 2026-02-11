import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';

// Import DTOs
import type {
  AdminUserGrowthAnalyticsResponse,
  AdminContentTrendsResponse,
  AdminEngagementMetricsResponse,
  AdminRevenueAnalyticsResponse,
  AdminPlatformHealthResponse,
  AdminAnalyticsExportResponse,
} from '../dtos/admin-analytics.dto';

const router = Router();
const prisma = getPrisma();

/**
 * Analytics Router
 * Routes are mounted at /admin/analytics
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== User Growth Analytics ====================

/**
 * GET /admin/analytics/users
 * Get user growth analytics
 */
router.get(
  '/users',
  asyncHandler(async (req: Request, res: Response) => {
    // Date ranges
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Total users
    const totalUsers = await prisma.user.count();

    // New users last month
    const newUsersLastMonth = await prisma.user.count({
      where: {
        createdAt: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
    });

    // New users previous month (for growth rate)
    const twoMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const twoMonthsAgoEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
    const newUsersPreviousMonth = await prisma.user.count({
      where: {
        createdAt: {
          gte: twoMonthsAgoStart,
          lte: twoMonthsAgoEnd,
        },
      },
    });

    // Growth rate calculation
    const growthRate =
      newUsersPreviousMonth > 0
        ? ((newUsersLastMonth - newUsersPreviousMonth) / newUsersPreviousMonth) * 100
        : 0;

    // Active users last month (users who updated their profile or created content)
    const activeUsersLastMonth = await prisma.user.count({
      where: {
        OR: [
          {
            updatedAt: {
              gte: startOfLastMonth,
              lte: endOfLastMonth,
            },
          },
          {
            posts: {
              some: {
                createdAt: {
                  gte: startOfLastMonth,
                  lte: endOfLastMonth,
                },
              },
            },
          },
        ],
      },
    });

    // Retention rate: users created 30-60 days ago who were active in last 30 days
    const usersCreated30To60DaysAgo = await prisma.user.count({
      where: {
        createdAt: {
          gte: sixtyDaysAgo,
          lte: thirtyDaysAgo,
        },
      },
    });

    const retainedUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: sixtyDaysAgo,
          lte: thirtyDaysAgo,
        },
        OR: [
          { updatedAt: { gte: thirtyDaysAgo } },
          { posts: { some: { createdAt: { gte: thirtyDaysAgo } } } },
        ],
      },
    });

    const retentionRate =
      usersCreated30To60DaysAgo > 0 ? (retainedUsers / usersCreated30To60DaysAgo) * 100 : 0;

    // User growth by day (last 30 days)
    const userGrowthByDay: { date: string; newUsers: number; activeUsers: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const [newUsers, activeUsers] = await Promise.all([
        prisma.user.count({
          where: {
            createdAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        }),
        prisma.user.count({
          where: {
            OR: [
              {
                updatedAt: {
                  gte: dayStart,
                  lte: dayEnd,
                },
              },
              {
                posts: {
                  some: {
                    createdAt: {
                      gte: dayStart,
                      lte: dayEnd,
                    },
                  },
                },
              },
            ],
          },
        }),
      ]);

      userGrowthByDay.push({
        date: dayStart.toISOString().split('T')[0],
        newUsers,
        activeUsers,
      });
    }

    const data: AdminUserGrowthAnalyticsResponse = {
      totalUsers,
      growthRate: Math.round(growthRate * 100) / 100,
      newUsersLastMonth,
      activeUsersLastMonth,
      retentionRate: Math.round(retentionRate * 100) / 100,
      userGrowthByDay,
    };

    return res.json({ success: true, data });
  })
);

// ==================== Content Trends Analytics ====================

/**
 * GET /admin/analytics/content
 * Get content trends analytics
 */
router.get(
  '/content',
  asyncHandler(async (req: Request, res: Response) => {
    // Date ranges
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Total posts and comments
    const [totalPosts, totalComments, postsLastMonth, commentsLastMonth] = await Promise.all([
      prisma.contentPost.count(),
      prisma.contentComment.count(),
      prisma.contentPost.count({
        where: {
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
      }),
      prisma.contentComment.count({
        where: {
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
      }),
    ]);

    // Top content types
    const postsByType = await prisma.contentPost.groupBy({
      by: ['type'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    const topContentTypes = postsByType.map((item) => ({
      type: item.type,
      count: item._count.id,
      percentage: totalPosts > 0 ? Math.round((item._count.id / totalPosts) * 10000) / 100 : 0,
    }));

    // Average engagement rate (comments + likes per post)
    const totalLikes = await prisma.contentLike.count();
    const avgEngagementRate =
      totalPosts > 0 ? Math.round(((totalComments + totalLikes) / totalPosts) * 100) / 100 : 0;

    // Content by day (last 30 days)
    const contentByDay: { date: string; posts: number; comments: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const [posts, comments] = await Promise.all([
        prisma.contentPost.count({
          where: {
            createdAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        }),
        prisma.contentComment.count({
          where: {
            createdAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        }),
      ]);

      contentByDay.push({
        date: dayStart.toISOString().split('T')[0],
        posts,
        comments,
      });
    }

    const data: AdminContentTrendsResponse = {
      totalPosts,
      postsLastMonth,
      totalComments,
      commentsLastMonth,
      avgEngagementRate,
      topContentTypes,
      contentByDay,
    };

    return res.json({ success: true, data });
  })
);

// ==================== Engagement Metrics Analytics ====================

/**
 * GET /admin/analytics/engagement
 * Get engagement metrics
 */
router.get(
  '/engagement',
  asyncHandler(async (req: Request, res: Response) => {
    // Total engagement counts
    const [totalLikes, totalComments, totalShares, totalPosts] = await Promise.all([
      prisma.contentLike.count(),
      prisma.contentComment.count(),
      prisma.contentShare.count(),
      prisma.contentPost.count(),
    ]);

    // Average post engagement
    const avgPostEngagement =
      totalPosts > 0
        ? Math.round(((totalLikes + totalComments + totalShares) / totalPosts) * 100) / 100
        : 0;

    // Top engaged users (by total likes + comments + shares received)
    const topEngagedUsersRaw = await prisma.user.findMany({
      take: 10,
      select: {
        id: true,
        profile: {
          select: {
            userName: true,
          },
        },
        posts: {
          select: {
            _count: {
              select: {
                likes: true,
                comments: true,
                shares: true,
              },
            },
          },
        },
      },
    });

    const topEngagedUsers = topEngagedUsersRaw
      .map((user) => {
        const engagementScore = user.posts.reduce(
          (sum, post) =>
            sum + post._count.likes + post._count.comments + post._count.shares,
          0
        );
        return {
          userId: user.id,
          username: user.profile?.userName || null,
          engagementScore,
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 10);

    // Engagement trends (last 30 days)
    const engagementTrends: { date: string; likes: number; comments: number; shares: number }[] =
      [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const [likes, comments, shares] = await Promise.all([
        prisma.contentLike.count({
          where: {
            createdAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        }),
        prisma.contentComment.count({
          where: {
            createdAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        }),
        prisma.contentShare.count({
          where: {
            createdAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        }),
      ]);

      engagementTrends.push({
        date: dayStart.toISOString().split('T')[0],
        likes,
        comments,
        shares,
      });
    }

    const data: AdminEngagementMetricsResponse = {
      totalLikes,
      totalComments,
      totalShares,
      avgPostEngagement,
      topEngagedUsers,
      engagementTrends,
    };

    return res.json({ success: true, data });
  })
);

// ==================== Revenue Analytics ====================

/**
 * GET /admin/analytics/revenue
 * Get revenue analytics
 */
router.get(
  '/revenue',
  asyncHandler(async (req: Request, res: Response) => {
    // Date ranges
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const twoMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const twoMonthsAgoEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);

    // Total revenue from NFT transactions
    const totalRevenueResult = await prisma.nFTTransaction.aggregate({
      _sum: {
        price: true,
      },
      where: {
        transactionType: 'SALE',
      },
    });
    const totalRevenue = totalRevenueResult._sum.price || 0;

    // Revenue last month
    const revenueLastMonthResult = await prisma.nFTTransaction.aggregate({
      _sum: {
        price: true,
      },
      where: {
        transactionType: 'SALE',
        createdAt: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
    });
    const revenueLastMonth = revenueLastMonthResult._sum.price || 0;

    // Revenue previous month (for growth rate)
    const revenuePreviousMonthResult = await prisma.nFTTransaction.aggregate({
      _sum: {
        price: true,
      },
      where: {
        transactionType: 'SALE',
        createdAt: {
          gte: twoMonthsAgoStart,
          lte: twoMonthsAgoEnd,
        },
      },
    });
    const revenuePreviousMonth = revenuePreviousMonthResult._sum.price || 0;

    // Growth rate
    const revenueGrowthRate =
      revenuePreviousMonth > 0
        ? ((revenueLastMonth - revenuePreviousMonth) / revenuePreviousMonth) * 100
        : 0;

    // Subscription revenue (from Invoice table)
    const subscriptionRevenueResult = await prisma.invoice.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: 'PAID',
      },
    });
    const subscriptionRevenue = subscriptionRevenueResult._sum.amount || 0;

    // NFT revenue
    const nftRevenue = totalRevenue;

    // Revenue by day (last 30 days)
    const revenueByDay: { date: string; revenue: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const [nftRevenueDay, subscriptionRevenueDay] = await Promise.all([
        prisma.nFTTransaction.aggregate({
          _sum: { price: true },
          where: {
            transactionType: 'SALE',
            createdAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        }),
        prisma.invoice.aggregate({
          _sum: { amount: true },
          where: {
            status: 'PAID',
            paidAt: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
        }),
      ]);

      const revenue = (nftRevenueDay._sum.price || 0) + (subscriptionRevenueDay._sum.amount || 0);

      revenueByDay.push({
        date: dayStart.toISOString().split('T')[0],
        revenue,
      });
    }

    // Top revenue users (by NFT purchases + subscriptions)
    const topRevenueUsersRaw = await prisma.user.findMany({
      take: 10,
      select: {
        id: true,
        profile: {
          select: {
            userName: true,
          },
        },
        nftTransactionsBuyer: {
          where: {
            transactionType: 'SALE',
          },
          select: {
            price: true,
          },
        },
        subscriptions: {
          where: {
            status: 'ACTIVE',
          },
          select: {
            plan: {
              select: {
                price: true,
              },
            },
          },
        },
      },
    });

    const topRevenueUsers = topRevenueUsersRaw
      .map((user) => {
        const nftSpent = user.nftTransactionsBuyer.reduce((sum, tx) => sum + tx.price, 0);
        const subscriptionSpent = user.subscriptions.reduce(
          (sum, sub) => sum + sub.plan.price,
          0
        );
        return {
          userId: user.id,
          username: user.profile?.userName || null,
          totalSpent: nftSpent + subscriptionSpent,
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    const data: AdminRevenueAnalyticsResponse = {
      totalRevenue,
      revenueLastMonth,
      revenueGrowthRate: Math.round(revenueGrowthRate * 100) / 100,
      subscriptionRevenue,
      nftRevenue,
      revenueByDay,
      topRevenueUsers,
    };

    return res.json({ success: true, data });
  })
);

// ==================== Platform Health Analytics ====================

/**
 * GET /admin/analytics/platform
 * Get platform health metrics
 */
router.get(
  '/platform',
  asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // User activity score (active users in last 30 days / total users)
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({
      where: {
        OR: [
          { updatedAt: { gte: thirtyDaysAgo } },
          { posts: { some: { createdAt: { gte: thirtyDaysAgo } } } },
        ],
      },
    });
    const userActivityScore = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;

    // User activity trend (compare last 30 days vs previous 30 days)
    const activeUsersPrevious = await prisma.user.count({
      where: {
        OR: [
          {
            updatedAt: {
              gte: sixtyDaysAgo,
              lte: thirtyDaysAgo,
            },
          },
          {
            posts: {
              some: {
                createdAt: {
                  gte: sixtyDaysAgo,
                  lte: thirtyDaysAgo,
                },
              },
            },
          },
        ],
      },
    });
    const userActivityTrend: 'up' | 'down' | 'stable' =
      activeUsers > activeUsersPrevious * 1.05
        ? 'up'
        : activeUsers < activeUsersPrevious * 0.95
          ? 'down'
          : 'stable';

    // Content quality score (posts with engagement / total posts in last 30 days)
    const postsLast30Days = await prisma.contentPost.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const postsWithEngagement = await prisma.contentPost.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        OR: [
          { likes: { some: {} } },
          { comments: { some: {} } },
          { shares: { some: {} } },
        ],
      },
    });

    const contentQualityScore =
      postsLast30Days > 0 ? (postsWithEngagement / postsLast30Days) * 100 : 0;

    // Content quality trend
    const postsPrevious30Days = await prisma.contentPost.count({
      where: {
        createdAt: {
          gte: sixtyDaysAgo,
          lte: thirtyDaysAgo,
        },
      },
    });

    const postsWithEngagementPrevious = await prisma.contentPost.count({
      where: {
        createdAt: {
          gte: sixtyDaysAgo,
          lte: thirtyDaysAgo,
        },
        OR: [
          { likes: { some: {} } },
          { comments: { some: {} } },
          { shares: { some: {} } },
        ],
      },
    });

    const contentQualityScorePrevious =
      postsPrevious30Days > 0 ? (postsWithEngagementPrevious / postsPrevious30Days) * 100 : 0;

    const contentQualityTrend: 'up' | 'down' | 'stable' =
      contentQualityScore > contentQualityScorePrevious * 1.05
        ? 'up'
        : contentQualityScore < contentQualityScorePrevious * 0.95
          ? 'down'
          : 'stable';

    // Engagement score (total engagement events / active users)
    const totalEngagement = await Promise.all([
      prisma.contentLike.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.contentComment.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.contentShare.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);
    const totalEngagementCount = totalEngagement.reduce((sum, count) => sum + count, 0);
    const engagementScore = activeUsers > 0 ? (totalEngagementCount / activeUsers) * 10 : 0;

    // Engagement trend
    const totalEngagementPrevious = await Promise.all([
      prisma.contentLike.count({
        where: {
          createdAt: {
            gte: sixtyDaysAgo,
            lte: thirtyDaysAgo,
          },
        },
      }),
      prisma.contentComment.count({
        where: {
          createdAt: {
            gte: sixtyDaysAgo,
            lte: thirtyDaysAgo,
          },
        },
      }),
      prisma.contentShare.count({
        where: {
          createdAt: {
            gte: sixtyDaysAgo,
            lte: thirtyDaysAgo,
          },
        },
      }),
    ]);
    const totalEngagementCountPrevious = totalEngagementPrevious.reduce(
      (sum, count) => sum + count,
      0
    );
    const engagementScorePrevious =
      activeUsersPrevious > 0 ? (totalEngagementCountPrevious / activeUsersPrevious) * 10 : 0;

    const engagementTrend: 'up' | 'down' | 'stable' =
      engagementScore > engagementScorePrevious * 1.05
        ? 'up'
        : engagementScore < engagementScorePrevious * 0.95
          ? 'down'
          : 'stable';

    // Revenue score (revenue last 30 days / total users)
    const revenueLast30Days = await prisma.nFTTransaction.aggregate({
      _sum: { price: true },
      where: {
        transactionType: 'SALE',
        createdAt: { gte: thirtyDaysAgo },
      },
    });
    const revenueScore =
      totalUsers > 0 ? ((revenueLast30Days._sum.price || 0) / totalUsers) * 10 : 0;

    // Revenue trend
    const revenuePrevious30Days = await prisma.nFTTransaction.aggregate({
      _sum: { price: true },
      where: {
        transactionType: 'SALE',
        createdAt: {
          gte: sixtyDaysAgo,
          lte: thirtyDaysAgo,
        },
      },
    });
    const revenueScorePrevious =
      totalUsers > 0 ? ((revenuePrevious30Days._sum.price || 0) / totalUsers) * 10 : 0;

    const revenueTrend: 'up' | 'down' | 'stable' =
      revenueScore > revenueScorePrevious * 1.05
        ? 'up'
        : revenueScore < revenueScorePrevious * 0.95
          ? 'down'
          : 'stable';

    // Overall score (weighted average)
    const overallScore = Math.min(
      100,
      (userActivityScore * 0.3 +
        contentQualityScore * 0.25 +
        engagementScore * 0.25 +
        revenueScore * 0.2)
    );

    // Platform issues
    const issues: { severity: 'low' | 'medium' | 'high'; message: string }[] = [];

    if (userActivityScore < 20) {
      issues.push({
        severity: 'high',
        message: 'User activity is critically low (<20%)',
      });
    } else if (userActivityScore < 40) {
      issues.push({
        severity: 'medium',
        message: 'User activity is below optimal (<40%)',
      });
    }

    if (contentQualityScore < 30) {
      issues.push({
        severity: 'high',
        message: 'Content quality is low - most posts have no engagement',
      });
    } else if (contentQualityScore < 50) {
      issues.push({
        severity: 'medium',
        message: 'Content quality could be improved',
      });
    }

    if (engagementScore < 2) {
      issues.push({
        severity: 'medium',
        message: 'Average user engagement is low (<2 actions per user)',
      });
    }

    if (userActivityTrend === 'down') {
      issues.push({
        severity: 'medium',
        message: 'User activity is trending downward',
      });
    }

    if (revenueTrend === 'down') {
      issues.push({
        severity: 'low',
        message: 'Revenue is trending downward',
      });
    }

    const data: AdminPlatformHealthResponse = {
      overallScore: Math.round(overallScore * 100) / 100,
      userActivity: {
        score: Math.round(userActivityScore * 100) / 100,
        trend: userActivityTrend,
      },
      contentQuality: {
        score: Math.round(contentQualityScore * 100) / 100,
        trend: contentQualityTrend,
      },
      engagement: {
        score: Math.round(engagementScore * 100) / 100,
        trend: engagementTrend,
      },
      revenue: {
        score: Math.round(revenueScore * 100) / 100,
        trend: revenueTrend,
      },
      issues,
    };

    return res.json({ success: true, data });
  })
);

// ==================== Analytics Export ====================

/**
 * GET /admin/analytics/export
 * Export analytics data
 */
router.get(
  '/export',
  asyncHandler(async (req: Request, res: Response) => {
    const format = (req.query.format as string) || 'json';
    const now = new Date();

    // Generate export URL (in a real system, this would create a file and upload to S3)
    const exportUrl = `https://cdn.tipbox.com/exports/analytics-${now.getTime()}.${format}`;

    // Expiration (24 hours)
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const data: AdminAnalyticsExportResponse = {
      exportUrl,
      format,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    return res.json({ success: true, data });
  })
);

export default router;
