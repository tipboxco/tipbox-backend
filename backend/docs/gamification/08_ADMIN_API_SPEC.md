# Admin API Specification

## Overview

This document defines admin-only gamification API endpoints for badge management, collection management, action log viewing, analytics, and user progress management.

## Base URL

All endpoints are prefixed with `/admin`

## Authentication & Authorization

All endpoints require:
1. **Authentication**: Valid JWT token via `authMiddleware`
2. **Authorization**: Admin role via `requireAdmin` middleware

---

## Existing Admin Endpoints (Already Implemented)

These endpoints are already functional in the codebase:

### Badge Management
- `GET /admin/badges` - List all badges with filters
- `POST /admin/badges` - Create new badge
- `PATCH /admin/badges/:id` - Update badge
- `DELETE /admin/badges/:id` - Delete badge

### Collection Management
- `GET /admin/collections` - List all collections
- `POST /admin/collections` - Create new collection
- `PATCH /admin/collections/:id` - Update collection
- `DELETE /admin/collections/:id` - Delete collection

### Collection Goals
- `GET /admin/collections/:id/goals` - List goals in collection
- `POST /admin/collections/:id/goals` - Add goal to collection
- `PATCH /admin/goals/:id` - Update goal
- `DELETE /admin/goals/:id` - Delete goal

### User Badge Management
- `GET /admin/users/:id/badges` - Get user's badges
- `POST /admin/users/:id/badges` - Grant badge to user
- `DELETE /admin/users/:userId/badges/:badgeId` - Remove badge from user

### Event Badge Management
- `GET /admin/events/:id/badges` - List event badges
- `POST /admin/events/:id/badges` - Create event badge
- `PATCH /admin/event-badges/:id` - Update event badge
- `DELETE /admin/event-badges/:id` - Delete event badge

### Badge Categories
- `GET /admin/badge-categories` - List all badge categories

---

## New Admin Endpoints (To Implement)

### GET /admin/action-logs

View user action history (audit trail).

**Authentication**: Admin only

**Query Parameters**:
```typescript
{
  userId?: string; // UUID - Filter by user
  mainAction?: 'POST' | 'LIKE' | 'COMMENT' | 'BOOKMARK' | 'JOIN' | 'SHARE' | 'SYSTEM';
  entityType?: string; // e.g., "post", "comment", "event"
  startDate?: string; // ISO datetime
  endDate?: string; // ISO datetime
  limit?: number; // Default: 50, Max: 100
  offset?: number; // Default: 0
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    logs: Array<{
      id: string;
      userId: string;
      user: {
        username: string;
        email: string;
      };
      mainAction: MainAction;
      actionType: {
        label: string;
      };
      entityType: string;
      entityId: string;
      metadata: Record<string, unknown> | null;
      createdAt: Date;
    }>;
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }
}
```

**Example**:
```http
GET /admin/action-logs?userId=550e8400-e29b-41d4-a716-446655440000&mainAction=POST&limit=50
```

**Implementation**:
```typescript
router.get(
  '/admin/action-logs',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const actionLogService = new ActionLogService();
    const filters = {
      userId: req.query.userId as string,
      mainAction: req.query.mainAction as MainAction,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const logs = await actionLogService.getUserActionHistory(filters.userId, filters);

    return res.json({ success: true, data: { logs } });
  })
);
```

---

### GET /admin/users/:userId/progress

View user's complete achievement progress.

**Authentication**: Admin only

**Path Parameters**:
- `userId` (string, UUID) - User ID

**Response**:
```typescript
{
  success: true,
  data: {
    user: {
      id: string;
      username: string;
      email: string;
    };
    achievements: Array<{
      goalId: string;
      goal: {
        title: string;
        collection: {
          name: string;
        };
      };
      progress: number;
      pointsRequired: number;
      percentage: number;
      completed: boolean;
      completedAt: Date | null;
    }>;
    stats: {
      totalBadges: number;
      totalAchievements: number;
      completionRate: number; // % of achievements completed
    };
  }
}
```

**Example**:
```http
GET /admin/users/550e8400-e29b-41d4-a716-446655440000/progress
```

**Implementation**:
```typescript
router.get(
  '/admin/users/:userId/progress',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.userId;
    const gamificationService = new GamificationService();

    const achievements = await gamificationService.getUserAchievements(userId);
    const stats = await gamificationService.getUserGamificationStats(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        profile: { select: { username: true } },
        email: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.profile?.username || 'Unknown',
          email: user.email,
        },
        achievements,
        stats: {
          totalBadges: stats.badges.total,
          totalAchievements: stats.achievements.total,
          completionRate: stats.achievements.total > 0
            ? (stats.achievements.completed / stats.achievements.total) * 100
            : 0,
        },
      },
    });
  })
);
```

---

### POST /admin/users/:userId/backfill-progress

Backfill achievement progress from existing data.

**Authentication**: Admin only

**Path Parameters**:
- `userId` (string, UUID) - User ID

**Request Body**:
```typescript
{
  recalculate?: boolean; // If true, recalculate from scratch (default: false)
}
```

**Response**:
```typescript
{
  success: true,
  message: "Progress backfilled successfully",
  data: {
    achievementsUpdated: number;
    badgesGranted: number;
  }
}
```

**Example**:
```http
POST /admin/users/550e8400-e29b-41d4-a716-446655440000/backfill-progress

{
  "recalculate": true
}
```

**Implementation**:
```typescript
router.post(
  '/admin/users/:userId/backfill-progress',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.userId;
    const actionLogService = new ActionLogService();

    const achievementsUpdated = await actionLogService.backfillActionsFromExistingData(userId);

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: req.user!.id,
        action: 'USER_PROGRESS_BACKFILL',
        description: `userId: ${userId}`,
        entityType: 'user',
        entityId: 0,
      },
    });

    return res.json({
      success: true,
      message: 'Progress backfilled successfully',
      data: { achievementsUpdated, badgesGranted: 0 }, // TODO: Track badges granted
    });
  })
);
```

---

### POST /admin/badges/bulk-grant

Grant badge to multiple users at once.

**Authentication**: Admin only

**Request Body**:
```typescript
{
  badgeId: string; // UUID
  userIds: string[]; // Array of user UUIDs
  claimed?: boolean; // Default: false
  visibility?: 'PUBLIC' | 'FRIENDS' | 'TRUSTERS' | 'PRIVATE'; // Default: PUBLIC
}
```

**Response**:
```typescript
{
  success: true,
  message: "Badge granted to N users",
  data: {
    successful: number;
    failed: number;
    errors: Array<{
      userId: string;
      error: string;
    }>;
  }
}
```

**Example**:
```http
POST /admin/badges/bulk-grant

{
  "badgeId": "550e8400-e29b-41d4-a716-446655440000",
  "userIds": ["user-uuid-1", "user-uuid-2", "user-uuid-3"],
  "claimed": false,
  "visibility": "PUBLIC"
}
```

**Implementation**:
```typescript
router.post(
  '/admin/badges/bulk-grant',
  authMiddleware,
  requireAdmin,
  validateBody(AdminBulkGrantBadgeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { badgeId, userIds, claimed, visibility } = req.body;
    const gamificationService = new GamificationService();

    let successful = 0;
    let failed = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (const userId of userIds) {
      try {
        await gamificationService.grantBadgeToUser(userId, badgeId);

        // Update claim status and visibility if specified
        if (claimed !== undefined || visibility !== undefined) {
          const userBadge = await prisma.userBadge.findFirst({
            where: { userId, badgeId },
          });

          if (userBadge) {
            await prisma.userBadge.update({
              where: { id: userBadge.id },
              data: {
                ...(claimed !== undefined && { claimed, claimedAt: claimed ? new Date() : null }),
                ...(visibility !== undefined && { visibility }),
              },
            });
          }
        }

        successful++;
      } catch (error) {
        failed++;
        errors.push({
          userId,
          error: getErrorMessage(error),
        });
      }
    }

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: req.user!.id,
        action: 'BADGE_BULK_GRANT',
        description: `badgeId: ${badgeId}, users: ${successful}/${userIds.length}`,
        entityType: 'badge',
        entityId: 0,
      },
    });

    return res.json({
      success: true,
      message: `Badge granted to ${successful} users`,
      data: { successful, failed, errors },
    });
  })
);
```

**Validation Schema**:
```typescript
const AdminBulkGrantBadgeSchema = z.object({
  badgeId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).min(1).max(100), // Max 100 users per batch
  claimed: z.boolean().optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'TRUSTERS', 'PRIVATE']).optional(),
});
```

---

### GET /admin/gamification/analytics

Overall gamification analytics dashboard.

**Authentication**: Admin only

**Response**:
```typescript
{
  success: true,
  data: {
    badges: {
      total: number;
      byType: Record<BadgeType, number>;
      byRarity: Record<BadgeRarity, number>;
      totalEarned: number; // Total UserBadge count
      claimRate: number; // % of badges claimed
    };
    collections: {
      total: number;
      avgGoalsPerCollection: number;
      avgBadgesPerCollection: number;
    };
    achievements: {
      total: number;
      completed: number;
      completionRate: number; // % completed
    };
    topBadges: Array<{
      badgeId: string;
      badgeName: string;
      earnedCount: number;
    }>; // Top 10 most earned badges
    topCollections: Array<{
      collectionId: string;
      collectionName: string;
      completionCount: number;
    }>; // Top 10 most completed collections
    recentActivity: Array<{
      userId: string;
      username: string;
      action: string; // "earned_badge", "completed_achievement"
      entityName: string;
      timestamp: Date;
    }>; // Last 20 activities
  }
}
```

**Example**:
```http
GET /admin/gamification/analytics
```

**Implementation**:
```typescript
router.get(
  '/admin/gamification/analytics',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    // Badge stats
    const totalBadges = await prisma.badge.count();
    const badgesByType = await prisma.badge.groupBy({
      by: ['type'],
      _count: { id: true },
    });
    const badgesByRarity = await prisma.badge.groupBy({
      by: ['rarity'],
      _count: { id: true },
    });
    const totalEarned = await prisma.userBadge.count();
    const claimedCount = await prisma.userBadge.count({ where: { claimed: true } });

    // Collection stats
    const totalCollections = await prisma.badgeCollection.count();
    const collectionGoals = await prisma.achievementGoal.groupBy({
      by: ['collectionId'],
      _count: { id: true },
    });
    const avgGoalsPerCollection = collectionGoals.length > 0
      ? collectionGoals.reduce((sum, c) => sum + c._count.id, 0) / collectionGoals.length
      : 0;

    // Achievement stats
    const totalAchievements = await prisma.userAchievement.count();
    const completedAchievements = await prisma.userAchievement.count({
      where: { completed: true },
    });

    // Top badges
    const topBadges = await prisma.badge.findMany({
      include: {
        _count: { select: { userBadges: true } },
      },
      orderBy: {
        userBadges: { _count: 'desc' },
      },
      take: 10,
    });

    // Top collections (by completion count)
    // TODO: Implement complex query for collection completions

    // Recent activity
    const recentBadges = await prisma.userBadge.findMany({
      where: { claimedAt: { not: null } },
      include: {
        user: { include: { profile: true } },
        badge: true,
      },
      orderBy: { claimedAt: 'desc' },
      take: 20,
    });

    const recentActivity = recentBadges.map(ub => ({
      userId: ub.userId,
      username: ub.user.profile?.username || 'Unknown',
      action: 'earned_badge',
      entityName: ub.badge.name,
      timestamp: ub.claimedAt!,
    }));

    return res.json({
      success: true,
      data: {
        badges: {
          total: totalBadges,
          byType: Object.fromEntries(badgesByType.map(b => [b.type, b._count.id])),
          byRarity: Object.fromEntries(badgesByRarity.map(b => [b.rarity, b._count.id])),
          totalEarned,
          claimRate: totalEarned > 0 ? (claimedCount / totalEarned) * 100 : 0,
        },
        collections: {
          total: totalCollections,
          avgGoalsPerCollection,
          avgBadgesPerCollection: 0, // TODO: Calculate
        },
        achievements: {
          total: totalAchievements,
          completed: completedAchievements,
          completionRate: totalAchievements > 0
            ? (completedAchievements / totalAchievements) * 100
            : 0,
        },
        topBadges: topBadges.map(b => ({
          badgeId: b.id,
          badgeName: b.name,
          earnedCount: b._count.userBadges,
        })),
        topCollections: [], // TODO: Implement
        recentActivity,
      },
    });
  })
);
```

---

### DELETE /admin/users/:userId/progress/reset

Reset user's achievement progress (for debugging/support).

**Authentication**: Admin only

**Path Parameters**:
- `userId` (string, UUID) - User ID

**Query Parameters**:
```typescript
{
  goalId?: string; // UUID - Reset specific goal only
  collectionId?: string; // UUID - Reset all goals in collection
  // If neither specified, reset ALL progress
}
```

**Response**:
```typescript
{
  success: true,
  message: "Progress reset successfully"
}
```

**Example**:
```http
DELETE /admin/users/550e8400-e29b-41d4-a716-446655440000/progress/reset?collectionId=collection-uuid
```

**Implementation**:
```typescript
router.delete(
  '/admin/users/:userId/progress/reset',
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.userId;
    const goalId = req.query.goalId as string | undefined;
    const collectionId = req.query.collectionId as string | undefined;

    if (goalId) {
      // Reset specific goal
      await prisma.userAchievement.deleteMany({
        where: { userId, goalId },
      });
    } else if (collectionId) {
      // Reset all goals in collection
      const goals = await prisma.achievementGoal.findMany({
        where: { collectionId },
        select: { id: true },
      });
      const goalIds = goals.map(g => g.id);

      await prisma.userAchievement.deleteMany({
        where: { userId, goalId: { in: goalIds } },
      });
    } else {
      // Reset ALL progress
      await prisma.userAchievement.deleteMany({
        where: { userId },
      });
    }

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: req.user!.id,
        action: 'USER_PROGRESS_RESET',
        description: `userId: ${userId}, goalId: ${goalId || 'all'}, collectionId: ${collectionId || 'none'}`,
        entityType: 'user',
        entityId: 0,
      },
    });

    return res.json({ success: true, message: 'Progress reset successfully' });
  })
);
```

---

## Admin UI Components (Frontend)

For the admin panel frontend (React application):

### New Components to Create

**AdminActionLogViewer.tsx**
- Table view of action logs with filters
- Columns: User, Action Type, Entity, Metadata, Timestamp
- Filters: User search, action type dropdown, date range
- Pagination controls

**AdminUserProgressViewer.tsx**
- User achievement progress dashboard
- Shows all goals with progress bars
- Highlights near-completion goals
- Button to trigger backfill

**AdminGamificationAnalytics.tsx**
- Analytics overview with charts
- Badge distribution pie chart (by type, by rarity)
- Achievement completion rate line chart over time
- Top badges leaderboard
- Recent activity timeline

**AdminBulkBadgeGrant.tsx**
- Form to select badge
- User selection (multi-select or CSV upload)
- Options for claimed status and visibility
- Confirmation dialog before granting
- Results display with success/failure counts

**AdminBackfillTool.tsx**
- User selection
- Backfill options (recalculate checkbox)
- Progress indicator during backfill
- Results summary

### Enhanced Components

**AdminBadgeList.tsx**
- Add "View Earners" button → Opens modal with recent earners
- Add "Bulk Grant" button → Opens AdminBulkBadgeGrant

**AdminCollectionDetail.tsx**
- Show completion stats (X users completed, Y% completion rate)
- Show goal-by-goal completion stats

**AdminUserDetail.tsx**
- Add "Gamification" tab
- Show user's badges, achievements, stats
- Button to view action logs
- Button to backfill progress

---

## Admin Logging

All admin actions are logged in the AdminLog table:

```typescript
await prisma.adminLog.create({
  data: {
    adminId: req.user!.id,
    action: 'ACTION_CODE',
    description: 'Detailed description',
    entityType: 'badge', // or 'collection', 'user', etc.
    entityId: 0, // Numeric ID if applicable
  },
});
```

**Action Codes**:
- `BADGE_CREATE`, `BADGE_UPDATE`, `BADGE_DELETE`
- `COLLECTION_CREATE`, `COLLECTION_UPDATE`, `COLLECTION_DELETE`
- `BADGE_GRANT`, `BADGE_BULK_GRANT`, `BADGE_REVOKE`
- `USER_PROGRESS_BACKFILL`, `USER_PROGRESS_RESET`
- `GOAL_CREATE`, `GOAL_UPDATE`, `GOAL_DELETE`

---

## Security Considerations

### Authorization
- All endpoints require admin role
- Verify `req.user` has admin privileges
- Log all admin actions for audit trail

### Rate Limiting
- Bulk operations (bulk grant, backfill) should have rate limits
- Prevent abuse of analytics endpoints (expensive queries)

### Input Validation
- Validate all UUIDs
- Limit batch sizes (max 100 users for bulk grant)
- Sanitize search inputs to prevent SQL injection

---

**Document Version**: 1.0
**Last Updated**: 2026-02-11
**Related Specs**: 07_USER_API_SPEC.md, 06_ACTION_LOGGING_SPEC.md
