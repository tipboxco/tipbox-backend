# Progress Tracking Specification

## Overview

The UserAchievement model tracks per-user progress toward completing AchievementGoals. This document defines the progress tracking system, milestone detection, and query patterns.

## UserAchievement Model

### Database Schema

```prisma
model UserAchievement {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  goalId      String    @map("goal_id") @db.Uuid
  progress    Int       @default(0) @db.Integer
  completed   Boolean   @default(false)
  completedAt DateTime? @map("completed_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  user User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  goal AchievementGoal @relation(fields: [goalId], references: [id], onDelete: Cascade)

  @@unique([userId, goalId])
  @@index([userId, completed])
  @@index([goalId, completed])
  @@map("user_achievements")
}
```

### Field Descriptions

**progress** (Integer, Default: 0)
- Current count of actions performed
- Example: User created 7 posts → progress=7
- Never decreases (monotonically increasing)

**completed** (Boolean, Default: false)
- True when progress >= goal.pointsRequired
- Once true, never becomes false

**completedAt** (DateTime, Nullable)
- Timestamp when goal was completed
- Null until completed
- Set when completed=true is first set

## Progress Increment Flow

### Triggered by User Action

```
User creates experience post
  ↓
PostService.createPost() succeeds
  ↓
Service calls achievementProgressService.incrementProgressByCode(userId, POST, EXPERIENCE, 1)
  ↓
AchievementProgressService:
  1. Find ActionType(mainAction=POST, code=EXPERIENCE)
  2. Find all AchievementGoals with this actionTypeId
  3. For each goal:
     ↓
     incrementProgress(userId, goalId, 1)
       ↓
       a. Upsert UserAchievement (create if doesn't exist)
       b. Atomic increment: progress = progress + 1
       c. Fetch updated record
       d. Check milestone detection (25%, 50%, 75%, 90%)
          → Send ACHIEVEMENT_PROGRESS notification
       e. Check completion (progress >= pointsRequired)
          → Set completed=true, completedAt=now()
          → Grant reward badge
          → Send ACHIEVEMENT_COMPLETED notification
```

### Implementation

```typescript
async incrementProgress(
  userId: string,
  goalId: string,
  amount: number = 1
): Promise<void> {
  const goal = await prisma.achievementGoal.findUnique({
    where: { id: goalId },
    include: { rewardBadge: true, collection: true },
  });

  if (!goal) {
    logger.warn('Goal not found', { goalId });
    return;
  }

  // Get current progress
  const existing = await prisma.userAchievement.findUnique({
    where: { userId_goalId: { userId, goalId } },
  });

  const previousProgress = existing?.progress || 0;
  const wasCompleted = existing?.completed || false;

  // Upsert and increment atomically
  const updated = await prisma.userAchievement.upsert({
    where: { userId_goalId: { userId, goalId } },
    create: {
      userId,
      goalId,
      progress: amount,
      completed: false,
    },
    update: {
      progress: { increment: amount },
    },
  });

  const newProgress = updated.progress + amount;

  // Milestone detection (if not completed yet)
  if (!wasCompleted && newProgress < goal.pointsRequired) {
    const prevPercentage = (previousProgress / goal.pointsRequired) * 100;
    const newPercentage = (newProgress / goal.pointsRequired) * 100;
    const milestones = [25, 50, 75, 90];

    for (const milestone of milestones) {
      if (prevPercentage < milestone && newPercentage >= milestone) {
        await this.notificationService.sendNotification(
          userId,
          NotificationType.ACHIEVEMENT_PROGRESS,
          {
            goalTitle: goal.title || goal.requirement,
            progress: newProgress,
            pointsRequired: goal.pointsRequired,
            percentage: milestone,
            remaining: goal.pointsRequired - newProgress,
          }
        ).catch(err => {
          logger.warn('Failed to send milestone notification', { error: getErrorMessage(err) });
        });

        logger.info('Milestone reached', {
          userId,
          goalId,
          milestone,
          progress: newProgress,
        });
      }
    }
  }

  // Completion check
  if (!wasCompleted && newProgress >= goal.pointsRequired) {
    await prisma.userAchievement.update({
      where: { id: updated.id },
      data: {
        completed: true,
        completedAt: new Date(),
      },
    });

    logger.info('Achievement goal completed', {
      userId,
      goalId,
      progress: newProgress,
    });

    // Grant reward badge
    if (goal.rewardBadgeId) {
      try {
        await this.gamificationService.grantBadgeToUser(userId, goal.rewardBadgeId);
      } catch (error) {
        logger.error('Failed to grant reward badge', {
          userId,
          goalId,
          badgeId: goal.rewardBadgeId,
          error: getErrorMessage(error),
        });
      }
    }

    // Send completion notification
    await this.notificationService.sendNotification(
      userId,
      NotificationType.ACHIEVEMENT_COMPLETED,
      {
        goalTitle: goal.title || goal.requirement,
        collectionName: goal.collection?.name,
        rewardBadge: goal.rewardBadge ? {
          id: goal.rewardBadge.id,
          name: goal.rewardBadge.name,
          imageUrl: goal.rewardBadge.imageUrl,
        } : null,
      }
    ).catch(err => {
      logger.warn('Failed to send completion notification', { error: getErrorMessage(err) });
    });
  }
}
```

## Milestone Detection

### Milestone Thresholds

- **25%**: Early progress encouragement
- **50%**: Halfway point motivation
- **75%**: Nearing completion push
- **90%**: Almost there! Final encouragement

### Notification Content

```typescript
{
  type: 'ACHIEVEMENT_PROGRESS',
  data: {
    goalTitle: "Experience Sharer",
    progress: 8,
    pointsRequired: 10,
    percentage: 80, // Milestone crossed
    remaining: 2,
    estimatedActionsNeeded: 2,
    collectionName: "Content Creator",
  }
}
```

### Visual Treatment (Frontend)

- 25%: Light blue progress bar
- 50%: Medium blue progress bar, confetti animation
- 75%: Dark blue progress bar, pulse animation
- 90%: Gold progress bar, sparkle animation

## Progress Query Methods

### Get Collection Progress

```typescript
async getCollectionProgress(
  userId: string,
  collectionId: string
): Promise<CollectionProgress> {
  const collection = await prisma.badgeCollection.findUnique({
    where: { id: collectionId },
    include: {
      achievementGoals: {
        include: {
          actionType: true,
          rewardBadge: true,
          userAchievements: {
            where: { userId },
          },
        },
      },
    },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  const goals = collection.achievementGoals.map((goal) => {
    const userAchievement = goal.userAchievements[0] || null;
    const progress = userAchievement?.progress || 0;
    const percentage = (progress / goal.pointsRequired) * 100;

    return {
      goalId: goal.id,
      title: goal.title,
      requirement: goal.requirement,
      actionType: {
        mainAction: goal.mainAction,
        label: goal.actionType.label,
      },
      pointsRequired: goal.pointsRequired,
      difficulty: goal.difficulty,
      rewardBadge: goal.rewardBadge,
      progress,
      percentage: Math.min(percentage, 100),
      completed: userAchievement?.completed || false,
      completedAt: userAchievement?.completedAt,
      remaining: Math.max(goal.pointsRequired - progress, 0),
    };
  });

  const completedGoals = goals.filter(g => g.completed).length;
  const totalGoals = goals.length;

  return {
    collectionId,
    userId,
    completedGoals,
    totalGoals,
    percentage: totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0,
    isCompleted: completedGoals === totalGoals && totalGoals > 0,
    goals,
  };
}
```

### Get Near-Completion Goals

Goals at 80%+ progress (configurable threshold):

```typescript
async getNearCompletionGoals(
  userId: string,
  threshold: number = 0.8
): Promise<NearCompletionGoal[]> {
  const userAchievements = await prisma.userAchievement.findMany({
    where: {
      userId,
      completed: false, // Only incomplete goals
    },
    include: {
      goal: {
        include: {
          collection: true,
          rewardBadge: {
            select: { id: true, name: true, imageUrl: true, rarity: true },
          },
        },
      },
    },
  });

  const nearCompletion = userAchievements
    .filter(ua => (ua.progress / ua.goal.pointsRequired) >= threshold)
    .map(ua => ({
      goalId: ua.goalId,
      title: ua.goal.title || ua.goal.requirement || 'Achievement',
      progress: ua.progress,
      pointsRequired: ua.goal.pointsRequired,
      percentage: (ua.progress / ua.goal.pointsRequired) * 100,
      remaining: ua.goal.pointsRequired - ua.progress,
      estimatedActionsNeeded: ua.goal.pointsRequired - ua.progress, // 1:1 mapping
      rewardBadge: ua.goal.rewardBadge,
      collection: {
        id: ua.goal.collection.id,
        name: ua.goal.collection.name,
      },
    }))
    .sort((a, b) => b.percentage - a.percentage); // Highest percentage first

  return nearCompletion;
}
```

### Get All User Achievements

```typescript
async getUserAchievements(
  userId: string,
  filters?: {
    completed?: boolean;
    collectionId?: string;
  }
): Promise<UserAchievementWithGoal[]> {
  const where: Prisma.UserAchievementWhereInput = { userId };

  if (filters?.completed !== undefined) {
    where.completed = filters.completed;
  }

  if (filters?.collectionId) {
    where.goal = { collectionId: filters.collectionId };
  }

  const achievements = await prisma.userAchievement.findMany({
    where,
    include: {
      goal: {
        include: {
          collection: true,
          actionType: true,
          rewardBadge: true,
        },
      },
    },
    orderBy: [
      { completed: 'desc' },
      { progress: 'desc' },
    ],
  });

  return achievements.map(ua => ({
    id: ua.id,
    goalId: ua.goalId,
    goal: {
      id: ua.goal.id,
      title: ua.goal.title,
      requirement: ua.goal.requirement,
      actionType: {
        mainAction: ua.goal.mainAction,
        label: ua.goal.actionType.label,
      },
      pointsRequired: ua.goal.pointsRequired,
      difficulty: ua.goal.difficulty,
      collection: ua.goal.collection,
      rewardBadge: ua.goal.rewardBadge,
    },
    progress: ua.progress,
    percentage: (ua.progress / ua.goal.pointsRequired) * 100,
    completed: ua.completed,
    completedAt: ua.completedAt,
    remaining: ua.goal.pointsRequired - ua.progress,
  }));
}
```

## Concurrency Safety

### Atomic Increments

Prisma's `increment` operation is atomic at the database level:

```typescript
update: {
  progress: { increment: 1 }, // Atomic operation
}
```

### Transaction Safety

For multi-step operations:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Increment progress
  const updated = await tx.userAchievement.update({
    where: { id: achievementId },
    data: { progress: { increment: 1 } },
  });

  // 2. Check completion
  if (updated.progress >= goal.pointsRequired && !updated.completed) {
    await tx.userAchievement.update({
      where: { id: updated.id },
      data: { completed: true, completedAt: new Date() },
    });

    // 3. Grant badge
    await tx.userBadge.create({
      data: { userId, badgeId: goal.rewardBadgeId },
    });
  }
});
```

### Row-Level Locking

For critical sections, use FOR UPDATE:

```sql
SELECT * FROM user_achievements
WHERE user_id = $1 AND goal_id = $2
FOR UPDATE;
```

```typescript
// Prisma doesn't directly support FOR UPDATE, but transactions provide isolation
await prisma.$transaction(async (tx) => {
  // Isolation level ensures consistency
  const achievement = await tx.userAchievement.findUnique({ ... });
  // ... update logic
});
```

## Performance Considerations

### Fire-and-Forget Pattern

Progress tracking is asynchronous and non-blocking:

```typescript
// In PostService
await this.postRepository.create(postData);

// Don't await - fire and forget
this.achievementProgressService.incrementProgressByCode(...)
  .catch(err => logger.warn('Progress tracking failed', { error }));

// Return immediately to user
return post;
```

### Batch Backfill

For historical data, use batched upserts:

```typescript
async backfillUserProgress(userId: string, batchSize: number = 100) {
  const postCounts = await prisma.contentPost.groupBy({
    by: ['type'],
    where: { userId },
    _count: { id: true },
  });

  const promises = [];

  for (const { type, _count } of postCounts) {
    const promise = this.upsertProgressFromTotal(
      userId,
      MainAction.POST,
      type,
      _count.id
    );
    promises.push(promise);

    if (promises.length >= batchSize) {
      await Promise.all(promises);
      promises.length = 0; // Clear array
    }
  }

  // Process remaining
  if (promises.length > 0) {
    await Promise.all(promises);
  }
}
```

### Index Optimization

Indexes for common queries:

```sql
-- User's achievements (completed and in-progress)
CREATE INDEX idx_user_achievements_user_completed
ON user_achievements(user_id, completed);

-- Goal's completions (for analytics)
CREATE INDEX idx_user_achievements_goal_completed
ON user_achievements(goal_id, completed);

-- Recent completions
CREATE INDEX idx_user_achievements_completed_at
ON user_achievements(completed_at DESC)
WHERE completed = true;
```

## Backfill Operations

### Upsert from Total

Set progress from existing data without decrementing:

```typescript
async upsertProgressFromTotal(
  userId: string,
  mainAction: MainAction,
  code: string,
  total: number
): Promise<void> {
  const actionType = await this.actionTypeRepo.findByMainActionAndCode(mainAction, code);
  if (!actionType) {
    logger.warn('ActionType not found for backfill', { mainAction, code });
    return;
  }

  const goals = await prisma.achievementGoal.findMany({
    where: { actionTypeId: actionType.id },
    include: { rewardBadge: true },
  });

  for (const goal of goals) {
    const existing = await prisma.userAchievement.findUnique({
      where: { userId_goalId: { userId, goalId: goal.id } },
    });

    if (!existing) {
      // Create new with total
      await prisma.userAchievement.create({
        data: {
          userId,
          goalId: goal.id,
          progress: total,
          completed: total >= goal.pointsRequired,
          completedAt: total >= goal.pointsRequired ? new Date() : null,
        },
      });

      if (total >= goal.pointsRequired && goal.rewardBadgeId) {
        await this.gamificationService.grantBadgeToUser(userId, goal.rewardBadgeId);
      }
    } else if (existing.progress < total) {
      // Update to higher value (never decrease)
      await prisma.userAchievement.update({
        where: { id: existing.id },
        data: {
          progress: total,
          completed: total >= goal.pointsRequired,
          completedAt: total >= goal.pointsRequired && !existing.completed
            ? new Date()
            : existing.completedAt,
        },
      });

      if (!existing.completed && total >= goal.pointsRequired && goal.rewardBadgeId) {
        await this.gamificationService.grantBadgeToUser(userId, goal.rewardBadgeId);
      }
    }
    // If existing.progress >= total: NO CHANGE
  }

  logger.info('Progress backfilled from total', { userId, mainAction, code, total });
}
```

### Admin Trigger

```http
POST /admin/users/:userId/backfill-progress
{
  "recalculate": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Progress backfilled successfully",
  "data": {
    "achievementsUpdated": 15,
    "badgesGranted": 3
  }
}
```

## Error Handling

### Missing Goal

```typescript
if (!goal) {
  logger.warn('Achievement goal not found', { goalId });
  return; // Graceful degradation
}
```

### Database Errors

```typescript
try {
  await prisma.userAchievement.update({ ... });
} catch (error) {
  logger.error('Failed to update progress', {
    userId,
    goalId,
    error: getErrorMessage(error),
  });
  // Don't throw - use fire-and-forget pattern
}
```

### Notification Failures

```typescript
await this.notificationService.sendNotification(...)
  .catch(err => {
    logger.warn('Failed to send notification', { error: getErrorMessage(err) });
    // Don't block progress tracking
  });
```

---

**Document Version**: 1.0
**Last Updated**: 2026-02-11
**Related Specs**: 04_EARNING_MECHANISMS_SPEC.md, 06_ACTION_LOGGING_SPEC.md
