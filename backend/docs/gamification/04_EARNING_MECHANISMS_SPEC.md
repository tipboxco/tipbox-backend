# Earning Mechanisms Specification

## Overview

This document describes how users earn badges across different badge types (COLLECTION, EVENT, COSMETIC, BRAND). Each type has distinct earning mechanisms and workflows.

## Collection Badge Earning (Primary Mechanism)

Collection badges are earned by completing Achievement Goals. This is the most common earning mechanism.

### Flow Diagram

```
User performs action (e.g., creates experience post)
  ↓
PostService.createPost() creates post
  ↓
Service calls achievementProgressService.incrementProgressByCode(userId, 'POST', 'EXPERIENCE', 1)
  ↓
AchievementProgressService:
  1. Find ActionType by (mainAction='POST', code='EXPERIENCE')
  2. Find all AchievementGoals with this actionTypeId
  3. For each goal:
     a. Upsert UserAchievement record
     b. Increment progress atomically
     c. Check milestones (25%, 50%, 75%, 90%)
        → Send ACHIEVEMENT_PROGRESS notification
     d. Check completion (progress >= pointsRequired)
        → Mark completed=true
        → Grant reward badge (if rewardBadgeId set)
        → Send NEW_BADGE + ACHIEVEMENT_COMPLETED notifications
  ↓
Badge appears in user's collection (claimed=false)
  ↓
User views /api/profile/badges
  ↓
User claims badge via POST /api/profile/badges/:badgeId/claim
  ↓
Badge marked as claimed, contributes to points, appears in showcase
```

### Key Service: AchievementProgressService

**Method**: `incrementProgressByCode(userId, mainAction, code, amount)`

**Implementation**:
```typescript
async incrementProgressByCode(
  userId: string,
  mainAction: MainAction,
  code: string,
  amount: number = 1
): Promise<void> {
  // 1. Find ActionType
  const actionType = await this.actionTypeRepo.findByMainActionAndCode(mainAction, code);
  if (!actionType) {
    logger.warn('ActionType not found', { mainAction, code });
    return;
  }

  // 2. Find all goals matching this ActionType
  const goals = await prisma.achievementGoal.findMany({
    where: { actionTypeId: actionType.id },
    include: { rewardBadge: true, collection: true },
  });

  // 3. Process each goal
  for (const goal of goals) {
    await this.incrementProgress(userId, goal.id, amount);
  }
}
```

**Atomic Progress Increment**:
```typescript
private async incrementProgress(userId: string, goalId: string, amount: number) {
  const goal = await prisma.achievementGoal.findUnique({ where: { id: goalId } });

  // Upsert and increment atomically
  const userAchievement = await prisma.userAchievement.upsert({
    where: { userId_goalId: { userId, goalId } },
    create: {
      userId,
      goalId,
      progress: amount,
      completed: amount >= goal.pointsRequired,
      completedAt: amount >= goal.pointsRequired ? new Date() : null,
    },
    update: {
      progress: { increment: amount },
    },
  });

  const newProgress = userAchievement.progress + amount;

  // Check completion
  if (!userAchievement.completed && newProgress >= goal.pointsRequired) {
    await prisma.userAchievement.update({
      where: { id: userAchievement.id },
      data: {
        completed: true,
        completedAt: new Date(),
      },
    });

    // Grant reward badge
    if (goal.rewardBadgeId) {
      await this.gamificationService.grantBadgeToUser(userId, goal.rewardBadgeId);
    }

    // Send notifications
    await this.notificationService.sendNotification(
      userId,
      NotificationType.ACHIEVEMENT_COMPLETED,
      { goalId, badgeId: goal.rewardBadgeId }
    );
  }
}
```

### Progress Tracking Integration Points

**PostService** (creates posts):
```typescript
// After creating post
await this.achievementProgressService.incrementProgressByCode(
  userId,
  MainAction.POST,
  postTypeToCode(post.type), // EXPERIENCE, TIPS, REVIEW, GENERAL
  1
).catch(err => logger.warn('Progress increment failed', { error }));
```

**InteractionService** (likes, comments, bookmarks):
```typescript
// After liking post
await this.achievementProgressService.incrementProgressByCode(
  userId,
  MainAction.LIKE,
  'ALL',
  1
).catch(err => logger.warn('Progress increment failed', { error }));

// After commenting
await this.achievementProgressService.incrementProgressByCode(
  userId,
  MainAction.COMMENT,
  'ALL',
  1
).catch(err => logger.warn('Progress increment failed', { error }));
```

**ProfileService** (system actions):
```typescript
// After completing profile
await this.achievementProgressService.incrementProgressByCode(
  userId,
  MainAction.SYSTEM,
  'PROFILE_COMPLETE',
  1
).catch(err => logger.warn('Progress increment failed', { error }));
```

## Event Badge Earning

Event badges are awarded to top performers after events end.

### Flow Diagram

```
Event ends (manual admin trigger or scheduled job)
  ↓
Admin calls EventBadgeDistributorService.distributeEventBadges(eventId)
  OR
Scheduler triggers distribution at event end time
  ↓
EventBadgeDistributorService:
  1. Fetch EventBadges for this event, ordered by rank (1, 2, 3)
  2. Fetch EventStats ordered by helpfulVotesReceived DESC
  3. Award badges:
     - Rank 1 badge → User with most votes
     - Rank 2 badge → User with 2nd most votes
     - Rank 3 badge → User with 3rd most votes
  4. Create UserBadge records (claimed=false)
  5. Send NEW_BADGE notifications
  ↓
Users receive notification
  ↓
Users claim badges via /api/profile/badges/:badgeId/claim
```

### Key Service: EventBadgeDistributorService

**Method**: `distributeEventBadges(eventId)`

**Implementation** (existing in codebase):
```typescript
async distributeEventBadges(eventId: string): Promise<void> {
  logger.info('Starting event badge distribution', { eventId });

  // 1. Get event badges ordered by rank
  const eventBadges = await prisma.eventBadge.findMany({
    where: { eventId },
    include: { badge: true },
    orderBy: { rank: 'asc' },
  });

  if (eventBadges.length === 0) {
    logger.warn('No event badges configured', { eventId });
    return;
  }

  // 2. Get top users by votes
  const topUsers = await prisma.eventStats.findMany({
    where: { eventId },
    orderBy: { helpfulVotesReceived: 'desc' },
    take: eventBadges.length,
    include: { user: true },
  });

  // 3. Distribute badges
  for (let i = 0; i < Math.min(eventBadges.length, topUsers.length); i++) {
    const eventBadge = eventBadges[i];
    const user = topUsers[i].user;

    try {
      await this.gamificationService.grantBadgeToUser(user.id, eventBadge.badgeId);
      logger.info('Event badge granted', {
        userId: user.id,
        badgeId: eventBadge.badgeId,
        rank: eventBadge.rank,
      });
    } catch (error) {
      logger.error('Failed to grant event badge', {
        userId: user.id,
        badgeId: eventBadge.badgeId,
        error: getErrorMessage(error),
      });
    }
  }

  logger.info('Event badge distribution complete', { eventId });
}
```

### Event Badge Configuration

**EventBadge Model**:
```prisma
model EventBadge {
  id        String   @id @default(uuid()) @db.Uuid
  eventId   String   @map("event_id") @db.Uuid
  badgeId   String   @map("badge_id") @db.Uuid
  rank      Int      @db.Integer
  createdAt DateTime @default(now()) @map("created_at")

  event Event @relation(fields: [eventId], references: [id], onDelete: Cascade)
  badge Badge @relation(fields: [badgeId], references: [id])

  @@unique([eventId, rank])
  @@map("event_badges")
}
```

**Admin Creates Event Badges**:
```http
POST /admin/events/:eventId/badges
{
  "badgeId": "uuid-of-gold-medal-badge",
  "rank": 1
}

POST /admin/events/:eventId/badges
{
  "badgeId": "uuid-of-silver-medal-badge",
  "rank": 2
}

POST /admin/events/:eventId/badges
{
  "badgeId": "uuid-of-bronze-medal-badge",
  "rank": 3
}
```

### Triggering Distribution

**Manual** (Admin Panel):
```http
POST /admin/events/:eventId/distribute-badges
```

**Scheduled** (BullMQ Worker):
```typescript
// In EventScheduler
const queue = new Queue('event-distribution', { connection: redisConnection });

// Schedule distribution 1 hour after event ends
await queue.add(
  'distribute-badges',
  { eventId },
  { delay: eventEndTime + 3600000 } // 1 hour delay
);

// Worker processes job
const worker = new Worker('event-distribution', async (job) => {
  await eventBadgeDistributorService.distributeEventBadges(job.data.eventId);
}, { connection: redisConnection });
```

## Manual Badge Granting (Admin)

Admins can grant any badge to any user manually.

### Flow Diagram

```
Admin grants badge via /admin/users/:userId/badges
  ↓
AdminRouter calls GamificationService.grantBadgeToUser(userId, badgeId)
  ↓
GamificationService:
  1. Create UserBadge record (claimed=false)
  2. Send NEW_BADGE notification
  ↓
Log admin action in AdminLog table
  ↓
Badge appears in user's pending rewards
```

### Admin Endpoint

```http
POST /admin/users/:userId/badges
{
  "badgeId": "uuid-of-badge"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Badge granted successfully",
  "data": {
    "userBadgeId": "uuid",
    "badge": {
      "id": "uuid",
      "name": "Special Achievement"
    }
  }
}
```

### Bulk Grant

Grant badge to multiple users at once:

```http
POST /admin/badges/bulk-grant
{
  "badgeId": "uuid-of-badge",
  "userIds": ["uuid1", "uuid2", "uuid3"],
  "claimed": false,
  "visibility": "PUBLIC"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Badge granted to 3 users",
  "data": {
    "successful": 3,
    "failed": 0,
    "errors": []
  }
}
```

## Automatic Badge Granting (System)

System can grant badges automatically for special events.

### Use Cases

**Account Anniversary**:
```typescript
// In scheduled job
const oneYearAgo = new Date();
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

const users = await prisma.user.findMany({
  where: {
    createdAt: {
      gte: oneYearAgo,
      lt: new Date(oneYearAgo.getTime() + 86400000), // 1 day window
    },
  },
});

for (const user of users) {
  await gamificationService.grantBadgeToUser(
    user.id,
    ANNIVERSARY_BADGE_ID,
    { reason: 'One year anniversary' }
  );
}
```

**Milestone Achievements**:
```typescript
// When user reaches 1000 posts
if (userPostCount === 1000) {
  await gamificationService.grantBadgeToUser(
    userId,
    THOUSAND_POSTS_BADGE_ID,
    { reason: '1000th post milestone' }
  );
}
```

## Badge Grant Rules & Validation

### Idempotency

**Rule**: Cannot grant same badge to user twice.

**Implementation**: Unique constraint on (userId, badgeId).

```typescript
try {
  const userBadge = await prisma.userBadge.create({
    data: { userId, badgeId, claimed: false },
  });
} catch (error) {
  if (error.code === 'P2002') { // Unique constraint violation
    logger.warn('Badge already granted', { userId, badgeId });
    return; // Silently ignore (idempotent)
  }
  throw error;
}
```

### Default State

All new badges start with:
- `claimed = false`
- `isVisible = true`
- `visibility = PUBLIC`
- `displayOrder = null`

### Notifications

All badge grants trigger NEW_BADGE notification:

```typescript
await notificationService.sendNotification(
  userId,
  NotificationType.NEW_BADGE,
  {
    badgeId,
    badgeName: badge.name,
    badgeImageUrl: badge.imageUrl,
    rarity: badge.rarity,
  }
);
```

### Atomic Transactions

Multi-step operations use transactions:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Create UserBadge
  const userBadge = await tx.userBadge.create({
    data: { userId, badgeId },
  });

  // 2. Mark achievement as completed
  await tx.userAchievement.update({
    where: { id: achievementId },
    data: { completed: true, completedAt: new Date() },
  });

  // 3. Update user stats
  await tx.user.update({
    where: { id: userId },
    data: { totalBadges: { increment: 1 } },
  });
});
```

## Progress Backfill

For existing users who performed actions before gamification was implemented.

### Backfill Strategy

**Method**: `upsertProgressFromTotal()`

**Behavior**:
- If UserAchievement doesn't exist: Create with progress=total
- If UserAchievement exists with lower progress: Update to total
- If UserAchievement exists with higher progress: NO CHANGE (never decrease)

**Implementation**:
```typescript
async upsertProgressFromTotal(
  userId: string,
  mainAction: MainAction,
  code: string,
  total: number
): Promise<void> {
  const actionType = await this.actionTypeRepo.findByMainActionAndCode(mainAction, code);
  if (!actionType) return;

  const goals = await prisma.achievementGoal.findMany({
    where: { actionTypeId: actionType.id },
  });

  for (const goal of goals) {
    const existing = await prisma.userAchievement.findUnique({
      where: { userId_goalId: { userId, goalId: goal.id } },
    });

    if (!existing) {
      // Create new
      await prisma.userAchievement.create({
        data: {
          userId,
          goalId: goal.id,
          progress: total,
          completed: total >= goal.pointsRequired,
          completedAt: total >= goal.pointsRequired ? new Date() : null,
        },
      });

      // Grant badge if completed
      if (total >= goal.pointsRequired && goal.rewardBadgeId) {
        await this.gamificationService.grantBadgeToUser(userId, goal.rewardBadgeId);
      }
    } else if (existing.progress < total) {
      // Update to higher value
      await prisma.userAchievement.update({
        where: { id: existing.id },
        data: {
          progress: total,
          completed: total >= goal.pointsRequired,
          completedAt: total >= goal.pointsRequired && !existing.completed ? new Date() : existing.completedAt,
        },
      });

      // Grant badge if now completed
      if (!existing.completed && total >= goal.pointsRequired && goal.rewardBadgeId) {
        await this.gamificationService.grantBadgeToUser(userId, goal.rewardBadgeId);
      }
    }
    // If existing.progress >= total: NO CHANGE
  }
}
```

### Backfill Trigger

**Admin Panel**:
```http
POST /admin/users/:userId/backfill-progress
{
  "recalculate": true
}
```

**Bulk Backfill** (Script):
```typescript
// scripts/backfill-all-users.ts
const users = await prisma.user.findMany();

for (const user of users) {
  // Count posts by type
  const experiencePosts = await prisma.contentPost.count({
    where: { userId: user.id, type: 'EXPERIENCE' },
  });
  await achievementProgressService.upsertProgressFromTotal(
    user.id,
    MainAction.POST,
    'EXPERIENCE',
    experiencePosts
  );

  // Repeat for other action types...
}
```

## Error Handling & Edge Cases

### Concurrent Increments

**Problem**: Two requests increment same achievement simultaneously.

**Solution**: Database-level atomic increment.

```typescript
// Prisma handles this atomically
update: {
  progress: { increment: 1 }, // Atomic operation
}
```

### Missing ActionType

**Problem**: incrementProgressByCode called with invalid action code.

**Solution**: Log warning, don't throw error.

```typescript
if (!actionType) {
  logger.warn('ActionType not found', { mainAction, code });
  return; // Graceful degradation
}
```

### Badge Already Granted

**Problem**: Attempt to grant badge user already has.

**Solution**: Catch unique constraint error, treat as success.

```typescript
try {
  await prisma.userBadge.create({ data: { userId, badgeId } });
} catch (error) {
  if (error.code === 'P2002') {
    logger.info('Badge already granted (idempotent)', { userId, badgeId });
    return; // Success (idempotent)
  }
  throw error;
}
```

### Progress Tracking Failure

**Problem**: Achievement progress increment fails.

**Solution**: Don't block user action, log error.

```typescript
// Fire-and-forget pattern
this.achievementProgressService.incrementProgressByCode(...)
  .catch(err => {
    logger.error('Progress increment failed', { error: getErrorMessage(err) });
    // Don't throw - user action should still succeed
  });
```

---

**Document Version**: 1.0
**Last Updated**: 2026-02-11
**Related Specs**: 05_PROGRESS_TRACKING_SPEC.md, 02_COLLECTION_SYSTEM_SPEC.md
