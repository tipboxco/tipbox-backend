# Action Logging Specification

## Overview

The ActionLog system provides a detailed audit trail of all user actions in Tipbox. While AchievementProgress tracks cumulative counts, ActionLog records individual action occurrences with metadata for analytics, debugging, and backfill support.

## ActionLog Model

### Database Schema

```prisma
model ActionLog {
  id           String     @id @default(uuid()) @db.Uuid
  userId       String     @map("user_id") @db.Uuid
  mainAction   MainAction @map("main_action")
  actionTypeId String     @map("action_type_id") @db.Uuid
  entityType   String     @map("entity_type") @db.VarChar(100)
  entityId     String     @map("entity_id") @db.VarChar(255)
  metadata     Json?
  createdAt    DateTime   @default(now()) @map("created_at")

  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  actionType ActionType @relation(fields: [actionTypeId], references: [id])

  @@index([userId, mainAction])
  @@index([userId, createdAt])
  @@index([entityType, entityId])
  @@map("action_logs")
}
```

### Field Descriptions

**userId** (UUID, Required)
- User who performed the action
- Cascade delete when user is deleted

**mainAction** (MainAction Enum, Required)
- Top-level action category
- Used for filtering and analytics

**actionTypeId** (UUID, Required)
- Links to specific ActionType
- Provides label and code

**entityType** (String, max 100 chars, Required)
- Type of entity acted upon
- Examples: "post", "comment", "event", "collection"

**entityId** (String, max 255 chars, Required)
- UUID or identifier of entity
- Allows linking back to source entity

**metadata** (JSON, Nullable)
- Additional contextual information
- Schema varies by action type

**createdAt** (DateTime, Auto-generated)
- Timestamp of action
- Indexed for time-based queries

## When to Log Actions

### POST Actions

**Trigger**: User creates content

**Example**:
```typescript
// In PostService.createPost()
const post = await this.postRepository.create(postData);

await this.actionLogService.logAction({
  userId,
  mainAction: MainAction.POST,
  actionTypeCode: 'EXPERIENCE',
  entityType: 'post',
  entityId: post.id,
  metadata: {
    postType: post.type,
    categoryId: post.categoryId,
    hasMedia: post.mediaUrls.length > 0,
    mediaCount: post.mediaUrls.length,
  },
}).catch(err => logger.warn('Action log failed', { error }));
```

### LIKE Actions

**Trigger**: User likes content

**Example**:
```typescript
// In InteractionService.likePost()
await this.actionLogService.logAction({
  userId,
  mainAction: MainAction.LIKE,
  actionTypeCode: 'ALL', // Or 'POST' for granular tracking
  entityType: 'post',
  entityId: postId,
  metadata: {
    postType: post.type,
    authorId: post.userId,
  },
}).catch(err => logger.warn('Action log failed', { error }));
```

### COMMENT Actions

**Trigger**: User creates comment

**Example**:
```typescript
// In InteractionService.createComment()
await this.actionLogService.logAction({
  userId,
  mainAction: MainAction.COMMENT,
  actionTypeCode: 'ALL',
  entityType: 'post',
  entityId: postId,
  metadata: {
    commentId: comment.id,
    commentLength: comment.body.length,
    hasMentions: comment.mentions.length > 0,
  },
}).catch(err => logger.warn('Action log failed', { error }));
```

### BOOKMARK Actions

**Trigger**: User bookmarks content

**Example**:
```typescript
// In InteractionService.bookmarkPost()
await this.actionLogService.logAction({
  userId,
  mainAction: MainAction.BOOKMARK,
  actionTypeCode: 'ALL',
  entityType: 'post',
  entityId: postId,
  metadata: {
    postType: post.type,
    categoryId: post.categoryId,
  },
}).catch(err => logger.warn('Action log failed', { error }));
```

### JOIN Actions

**Trigger**: User joins event

**Example**:
```typescript
// In EventService.joinEvent()
await this.actionLogService.logAction({
  userId,
  mainAction: MainAction.JOIN,
  actionTypeCode: 'ALL',
  entityType: 'event',
  entityId: eventId,
  metadata: {
    eventName: event.name,
    eventDate: event.startDate,
  },
}).catch(err => logger.warn('Action log failed', { error }));
```

### SHARE Actions (Future)

**Trigger**: User shares content

**Example**:
```typescript
// In SharingService.sharePost()
await this.actionLogService.logAction({
  userId,
  mainAction: MainAction.SHARE,
  actionTypeCode: 'POST',
  entityType: 'post',
  entityId: postId,
  metadata: {
    platform: 'twitter', // or 'facebook', 'internal'
    postType: post.type,
  },
}).catch(err => logger.warn('Action log failed', { error }));
```

### SYSTEM Actions

**Trigger**: System-level user actions

**Example**:
```typescript
// In ProfileService.completeProfile()
await this.actionLogService.logAction({
  userId,
  mainAction: MainAction.SYSTEM,
  actionTypeCode: 'PROFILE_COMPLETE',
  entityType: 'profile',
  entityId: profile.id,
  metadata: {
    fieldsCompleted: ['bio', 'avatar', 'location'],
    completionPercentage: 100,
  },
}).catch(err => logger.warn('Action log failed', { error }));
```

## ActionLogService Implementation

### logAction Method

```typescript
async logAction(params: {
  userId: string;
  mainAction: MainAction;
  actionTypeCode: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    // Find ActionType by mainAction + code
    const actionType = await this.actionTypeRepo.findByMainActionAndCode(
      params.mainAction,
      params.actionTypeCode
    );

    if (!actionType) {
      logger.warn('ActionType not found for logging', {
        mainAction: params.mainAction,
        code: params.actionTypeCode,
      });
      return;
    }

    // Create action log
    await prisma.actionLog.create({
      data: {
        userId: params.userId,
        mainAction: params.mainAction,
        actionTypeId: actionType.id,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : null,
      },
    });

    logger.info('Action logged', {
      userId: params.userId,
      mainAction: params.mainAction,
      entityType: params.entityType,
    });
  } catch (error) {
    logger.error('Failed to log action', {
      error: getErrorMessage(error),
      params,
    });
    // Don't throw - logging should never block user actions
  }
}
```

### getUserActionHistory Method

```typescript
async getUserActionHistory(
  userId: string,
  filters?: {
    mainAction?: MainAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<ActionLog[]> {
  const where: Prisma.ActionLogWhereInput = { userId };

  if (filters?.mainAction) {
    where.mainAction = filters.mainAction;
  }

  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  const logs = await prisma.actionLog.findMany({
    where,
    include: {
      actionType: true,
    },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit || 50,
    skip: filters?.offset || 0,
  });

  return logs;
}
```

### getActionCountsByType Method

```typescript
async getActionCountsByType(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<Record<string, number>> {
  const where: Prisma.ActionLogWhereInput = { userId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const counts = await prisma.actionLog.groupBy({
    by: ['mainAction'],
    where,
    _count: { id: true },
  });

  const result: Record<string, number> = {};
  counts.forEach((count) => {
    result[count.mainAction] = count._count.id;
  });

  return result;
}
```

### backfillActionsFromExistingData Method

```typescript
async backfillActionsFromExistingData(userId: string): Promise<number> {
  logger.info('Backfilling actions for user', { userId });

  let totalLogged = 0;

  // Backfill posts
  const posts = await prisma.contentPost.findMany({
    where: { userId },
    select: { id: true, type: true, categoryId: true, createdAt: true },
  });

  for (const post of posts) {
    await this.logAction({
      userId,
      mainAction: MainAction.POST,
      actionTypeCode: post.type,
      entityType: 'post',
      entityId: post.id,
      metadata: {
        postType: post.type,
        categoryId: post.categoryId,
        backfilled: true,
      },
    });
    totalLogged++;
  }

  // Backfill likes (example - adjust based on actual schema)
  // const likes = await prisma.like.findMany({ where: { userId } });
  // for (const like of likes) { ... }

  // Backfill comments
  // const comments = await prisma.comment.findMany({ where: { userId } });
  // for (const comment of comments) { ... }

  logger.info('Action backfill complete', { userId, totalLogged });

  return totalLogged;
}
```

## Use Cases

### 1. Audit Trail

**Admin View**: See complete history of user's actions

```http
GET /admin/action-logs?userId=uuid&limit=100
```

**Response**: Chronological list of all actions with metadata

**Purpose**: Investigate suspicious activity, verify badge eligibility, debug issues

### 2. Backfill Support

**Scenario**: New achievement goal created, need to credit existing users

**Process**:
1. Query ActionLog for relevant actions
2. Calculate totals per user
3. Use `upsertProgressFromTotal()` to credit progress

```typescript
async backfillGoal(goalId: string) {
  const goal = await prisma.achievementGoal.findUnique({ where: { id: goalId } });

  // Find all users who performed this action
  const actionCounts = await prisma.actionLog.groupBy({
    by: ['userId'],
    where: { actionTypeId: goal.actionTypeId },
    _count: { id: true },
  });

  for (const { userId, _count } of actionCounts) {
    await achievementProgressService.upsertProgressFromTotal(
      userId,
      goal.mainAction,
      goal.actionType.code,
      _count.id
    );
  }
}
```

### 3. Analytics

**User Engagement Metrics**:
```sql
SELECT
  DATE(created_at) as date,
  main_action,
  COUNT(*) as action_count
FROM action_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), main_action
ORDER BY date DESC, action_count DESC;
```

**Top Active Users**:
```sql
SELECT
  user_id,
  COUNT(*) as total_actions,
  COUNT(DISTINCT main_action) as unique_action_types
FROM action_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY total_actions DESC
LIMIT 20;
```

### 4. Debugging

**Why didn't badge grant?**

Check if action was logged:
```sql
SELECT * FROM action_logs
WHERE user_id = 'uuid'
  AND action_type_id = 'action-type-uuid'
ORDER BY created_at DESC;
```

If logged but no progress → Check AchievementProgressService
If not logged → Check service integration

### 5. Fraud Detection

**Suspicious Patterns**:
```sql
-- Users with abnormally high action frequency
SELECT
  user_id,
  main_action,
  COUNT(*) as action_count,
  COUNT(DISTINCT DATE(created_at)) as active_days,
  COUNT(*) / NULLIF(COUNT(DISTINCT DATE(created_at)), 0) as actions_per_day
FROM action_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY user_id, main_action
HAVING actions_per_day > 100 -- Threshold for suspicious activity
ORDER BY actions_per_day DESC;
```

## Performance Optimization

### Asynchronous Writes

All action logging is fire-and-forget:

```typescript
// Never await in main flow
this.actionLogService.logAction({...}).catch(err => {
  logger.warn('Action log failed', { error });
  // Don't throw - user action should succeed regardless
});
```

### Partitioning (Future Enhancement)

For high-volume systems, partition by month:

```sql
CREATE TABLE action_logs_2026_02 PARTITION OF action_logs
FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE action_logs_2026_03 PARTITION OF action_logs
FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

### Retention Policy

Delete logs older than 1 year (or archive to cold storage):

```sql
DELETE FROM action_logs
WHERE created_at < NOW() - INTERVAL '1 year';
```

### Index Strategy

Indexes for common queries:

```sql
-- User's recent actions
CREATE INDEX idx_action_logs_user_created
ON action_logs(user_id, created_at DESC);

-- Actions by type and time
CREATE INDEX idx_action_logs_type_created
ON action_logs(action_type_id, created_at DESC);

-- Entity actions
CREATE INDEX idx_action_logs_entity
ON action_logs(entity_type, entity_id);
```

## Privacy Considerations

### Data Access

- **Users**: Cannot view their own ActionLog (only achievement progress)
- **Admins**: Can view ActionLog for audit and debugging
- **System**: Uses ActionLog for analytics and backfill

### Anonymization

For aggregate analytics, anonymize user data:

```sql
SELECT
  main_action,
  DATE(created_at) as date,
  COUNT(*) as action_count,
  COUNT(DISTINCT user_id) as unique_users
FROM action_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY main_action, DATE(created_at);
-- No user_id in result
```

### Data Retention

- **Active Logs**: 1 year retention
- **Archived Logs**: 3 years in cold storage
- **Deleted Logs**: Purged after 3 years

## Error Handling

### Invalid ActionType

```typescript
if (!actionType) {
  logger.warn('ActionType not found', { mainAction, code });
  return; // Graceful degradation, don't throw
}
```

### Database Errors

```typescript
try {
  await prisma.actionLog.create({ data });
} catch (error) {
  logger.error('Failed to create action log', { error: getErrorMessage(error) });
  // Don't throw - logging failures should not block user actions
}
```

### Invalid Metadata

```typescript
// Sanitize metadata before logging
const sanitizedMetadata = metadata ? JSON.parse(JSON.stringify(metadata)) : null;
```

## Admin Endpoints

### GET /admin/action-logs

**Query Params**:
- `userId` (UUID) - Filter by user
- `mainAction` (MainAction) - Filter by action type
- `entityType` (string) - Filter by entity
- `startDate` (ISO datetime) - Start of date range
- `endDate` (ISO datetime) - End of date range
- `limit` (integer, default: 50, max: 100)
- `offset` (integer, default: 0)

**Response**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "userId": "uuid",
        "user": {
          "username": "johndoe",
          "email": "john@example.com"
        },
        "mainAction": "POST",
        "actionType": {
          "label": "Experience Post"
        },
        "entityType": "post",
        "entityId": "uuid",
        "metadata": {
          "postType": "EXPERIENCE",
          "hasMedia": true
        },
        "createdAt": "2026-02-11T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 500,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

**Document Version**: 1.0
**Last Updated**: 2026-02-11
**Related Specs**: 03_ACTION_TYPES_SPEC.md, 05_PROGRESS_TRACKING_SPEC.md
