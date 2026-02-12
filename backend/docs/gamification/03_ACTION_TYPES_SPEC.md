# Action Types Specification

## Overview

ActionTypes define all trackable user actions in the Tipbox gamification system. Each action type represents a specific user behavior that can contribute to achievement progress. The system uses a flexible (mainAction, code) tuple structure for extensibility.

## MainAction Enum

Top-level action categories that group related actions.

### POST
**Purpose**: Content creation actions

**Description**: Any action related to creating posts/content

**Examples**:
- Creating experience posts
- Creating tips posts
- Creating review posts
- Creating general posts

**Tracking**: Triggered when user creates new ContentPost

### LIKE
**Purpose**: Content appreciation actions

**Description**: Liking or favoriting content

**Examples**:
- Liking posts
- Liking comments (future)
- Liking collections (future)

**Tracking**: Triggered via interaction service

### COMMENT
**Purpose**: Content engagement actions

**Description**: Adding comments to content

**Examples**:
- Commenting on posts
- Replying to comments (future)

**Tracking**: Triggered when user creates comment

### BOOKMARK
**Purpose**: Content saving actions

**Description**: Bookmarking or saving content for later

**Examples**:
- Bookmarking posts
- Bookmarking collections (future)

**Tracking**: Triggered via interaction service

### JOIN
**Purpose**: Event/community participation

**Description**: Joining events or communities

**Examples**:
- Joining events
- Joining communities (future)
- Joining challenges (future)

**Tracking**: Triggered when user joins event

### SHARE
**Purpose**: Content distribution actions

**Description**: Sharing content to others or external platforms

**Examples**:
- Sharing posts
- Sharing collections
- Sharing events (future)

**Tracking**: Triggered when user shares content (not yet implemented)

### SYSTEM
**Purpose**: Platform-level actions

**Description**: System or profile-related actions

**Examples**:
- Completing profile
- Adding bio
- Adding inventory items
- Changing settings

**Tracking**: Triggered by system services

## ActionType Structure

### Database Schema

```prisma
model ActionType {
  id         String     @id @default(uuid()) @db.Uuid
  mainAction MainAction @map("main_action")
  code       String     @db.VarChar(100)
  label      String     @db.VarChar(500)
  createdAt  DateTime   @default(now()) @map("created_at")
  updatedAt  DateTime   @updatedAt @map("updated_at")

  achievementGoals AchievementGoal[]
  actionLogs       ActionLog[]

  @@unique([mainAction, code])
  @@map("action_types")
}
```

### Field Descriptions

**mainAction** (MainAction Enum, Required)
- Top-level action category
- One of: POST, LIKE, COMMENT, BOOKMARK, JOIN, SHARE, SYSTEM

**code** (String, max 100 chars, Required)
- Specific action subtype
- Examples: EXPERIENCE, TIPS, ALL, POST, COMMENT
- Used to differentiate actions within same mainAction

**label** (Human-readable string, Required)
- Display name for the action
- Used in UI and notifications
- Examples: "Experience Post", "Like Action", "Complete Profile"

**Unique Constraint**: (mainAction, code)
- Prevents duplicate action types
- Ensures consistent tracking

## Seeded Action Types (Phase 1)

The following 11 action types are seeded via database migration:

| ID | mainAction | code | label | Example Trigger |
|----|------------|------|-------|-----------------|
| 1  | POST | EXPERIENCE | Experience Post | User creates experience post |
| 2  | POST | TIPS | Tips Post | User creates tip post |
| 3  | POST | REVIEW | Review Post | User creates review post |
| 4  | POST | GENERAL | General Post | User creates general post |
| 5  | LIKE | ALL | Like Action | User likes any content |
| 6  | COMMENT | ALL | Comment Action | User comments on any content |
| 7  | BOOKMARK | ALL | Bookmark Action | User bookmarks any content |
| 8  | JOIN | ALL | Join Action | User joins event |
| 9  | SYSTEM | PROFILE_COMPLETE | Complete Profile | User completes profile |
| 10 | SYSTEM | BIO_ADD | Add Bio | User adds bio |
| 11 | SYSTEM | INVENTORY_ADD | Add Inventory Item | User adds inventory item |

### Seed Migration

```sql
INSERT INTO "action_types" ("id", "main_action", "code", "label", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'POST', 'EXPERIENCE', 'Experience Post', NOW(), NOW()),
  (gen_random_uuid(), 'POST', 'TIPS', 'Tips Post', NOW(), NOW()),
  (gen_random_uuid(), 'POST', 'REVIEW', 'Review Post', NOW(), NOW()),
  (gen_random_uuid(), 'POST', 'GENERAL', 'General Post', NOW(), NOW()),
  (gen_random_uuid(), 'LIKE', 'ALL', 'Like Action', NOW(), NOW()),
  (gen_random_uuid(), 'COMMENT', 'ALL', 'Comment Action', NOW(), NOW()),
  (gen_random_uuid(), 'BOOKMARK', 'ALL', 'Bookmark Action', NOW(), NOW()),
  (gen_random_uuid(), 'JOIN', 'ALL', 'Join Action', NOW(), NOW()),
  (gen_random_uuid(), 'SYSTEM', 'PROFILE_COMPLETE', 'Complete Profile', NOW(), NOW()),
  (gen_random_uuid(), 'SYSTEM', 'BIO_ADD', 'Add Bio', NOW(), NOW()),
  (gen_random_uuid(), 'SYSTEM', 'INVENTORY_ADD', 'Add Inventory Item', NOW(), NOW())
ON CONFLICT (main_action, code) DO NOTHING;
```

## Granular Action Types (Phase 2+)

Future enhancements for more specific tracking:

### LIKE Granularity

| mainAction | code | label | Purpose |
|------------|------|-------|---------|
| LIKE | POST | Like Post | Distinguish post likes from comment likes |
| LIKE | COMMENT | Like Comment | Track engagement with comments specifically |
| LIKE | COLLECTION | Like Collection | Track collection appreciation (future) |

**Use Case**: Achievement goal "Like 100 posts" vs "Like 50 comments"

### SHARE Granularity

| mainAction | code | label | Purpose |
|------------|------|-------|---------|
| SHARE | POST | Share Post | Track post sharing |
| SHARE | COLLECTION | Share Collection | Track collection sharing |
| SHARE | EVENT | Share Event | Track event promotion (future) |
| SHARE | EXTERNAL | External Share | Social media shares (future) |

**Use Case**: Achievement goal "Share 10 posts to social media"

### BOOKMARK Granularity

| mainAction | code | label | Purpose |
|------------|------|-------|---------|
| BOOKMARK | POST | Bookmark Post | Distinguish post bookmarks |
| BOOKMARK | COLLECTION | Bookmark Collection | Track collection saves |
| BOOKMARK | USER | Bookmark User | Save favorite users (future) |

**Use Case**: Achievement goal "Bookmark 25 posts"

### POST Granularity (Already Implemented)

| mainAction | code | label | Current Implementation |
|------------|------|-------|------------------------|
| POST | EXPERIENCE | Experience Post | ✅ Seeded |
| POST | TIPS | Tips Post | ✅ Seeded |
| POST | REVIEW | Review Post | ✅ Seeded |
| POST | GENERAL | General Post | ✅ Seeded |

**Future**:
- POST:QUESTION - Q&A posts
- POST:UPDATE - Status updates
- POST:STORY - Story posts

## Action Tracking Implementation

### Service Integration

Actions are tracked in two places:

1. **ActionLog** (audit trail, analytics)
2. **UserAchievement** (progress tracking)

Both are fire-and-forget (async, non-blocking).

### Tracking Pattern

```typescript
// In application service (e.g., PostService.createPost)
const post = await this.postRepository.create(postData);

// 1. Log action (fire-and-forget)
this.actionLogService.logAction({
  userId,
  mainAction: MainAction.POST,
  actionTypeCode: 'EXPERIENCE', // or TIPS, REVIEW, GENERAL
  entityType: 'post',
  entityId: post.id,
  metadata: {
    postType: post.type,
    categoryId: post.categoryId,
    hasMedia: post.mediaUrls && post.mediaUrls.length > 0,
  },
}).catch(err => {
  logger.warn('Failed to log action', { error: getErrorMessage(err) });
});

// 2. Increment achievement progress (fire-and-forget)
this.achievementProgressService.incrementProgressByCode(
  userId,
  MainAction.POST,
  'EXPERIENCE',
  1 // increment by 1
).catch(err => {
  logger.warn('Failed to increment progress', { error: getErrorMessage(err) });
});
```

### Finding ActionType

```typescript
// In ActionLogService or AchievementProgressService
const actionType = await prisma.actionType.findUnique({
  where: {
    mainAction_code: {
      mainAction: 'POST',
      code: 'EXPERIENCE',
    },
  },
});

if (!actionType) {
  logger.warn('ActionType not found', { mainAction: 'POST', code: 'EXPERIENCE' });
  return;
}
```

## Action Metadata

Actions can include contextual metadata stored as JSON in ActionLog.

### POST Actions

```json
{
  "postType": "EXPERIENCE",
  "categoryId": "uuid-of-category",
  "hasMedia": true,
  "mediaCount": 3,
  "tags": ["travel", "adventure"]
}
```

### LIKE Actions

```json
{
  "entityType": "post",
  "entityId": "uuid-of-post",
  "postType": "EXPERIENCE",
  "authorId": "uuid-of-author"
}
```

### COMMENT Actions

```json
{
  "postId": "uuid-of-post",
  "commentLength": 250,
  "hasMentions": true,
  "mentionedUserIds": ["uuid1", "uuid2"]
}
```

### SYSTEM Actions

```json
{
  "actionType": "PROFILE_COMPLETE",
  "fieldsCompleted": ["bio", "avatar", "location"],
  "completionPercentage": 100
}
```

## Action Tracking Rules

### Idempotency

**Problem**: User likes post, unlikes, likes again. Should this count as 1 or 2 likes?

**Solution**: Track each action occurrence in ActionLog (count as 2), but business logic in achievement goals determines if it's idempotent.

**Example**:
- "Like 100 posts" → Track unique posts liked (use DISTINCT in query)
- "Perform 100 like actions" → Track all likes (use COUNT)

**Current Implementation**: Simple increment on action (Phase 1 approach)
**Future Enhancement**: Idempotency flags per action type

### Retroactive Tracking

**Problem**: User performed actions before gamification system existed.

**Solution**: Backfill actions from existing data.

**Implementation**:
```typescript
async function backfillUserActions(userId: string) {
  // Count existing posts by type
  const postCounts = await prisma.contentPost.groupBy({
    by: ['type'],
    where: { userId },
    _count: { id: true },
  });

  for (const { type, _count } of postCounts) {
    const actionTypeCode = postTypeToActionCode(type); // EXPERIENCE, TIPS, etc.

    // Use upsertProgressFromTotal (never decreases progress)
    await achievementProgressService.upsertProgressFromTotal(
      userId,
      MainAction.POST,
      actionTypeCode,
      _count.id
    );
  }

  // Similar for likes, comments, bookmarks...
}
```

### Action Validation

**Before Logging**:
- Validate actionTypeCode exists
- Validate entityId is valid UUID
- Validate metadata is valid JSON

**Error Handling**:
- Log warning if validation fails
- Don't throw error (fire-and-forget)
- Track failed action logs in monitoring

## Action Code Mappings

### Post Type to Action Code

```typescript
enum ContentPostType {
  EXPERIENCE = 'EXPERIENCE',
  TIPS = 'TIPS',
  REVIEW = 'REVIEW',
  GENERAL = 'GENERAL',
  // Future types...
}

function postTypeToActionCode(postType: ContentPostType): string {
  // Currently 1:1 mapping
  return postType;
}
```

### Future Mappings

```typescript
// For granular LIKE tracking
function likeEntityToActionCode(entityType: string): string {
  switch (entityType) {
    case 'post': return 'POST';
    case 'comment': return 'COMMENT';
    case 'collection': return 'COLLECTION';
    default: return 'ALL'; // Fallback to current behavior
  }
}

// For granular BOOKMARK tracking
function bookmarkEntityToActionCode(entityType: string): string {
  switch (entityType) {
    case 'post': return 'POST';
    case 'collection': return 'COLLECTION';
    default: return 'ALL';
  }
}
```

## API Endpoints

Action types are managed via admin endpoints only (users don't create action types).

### Admin Endpoints

**GET /admin/action-types**
- List all action types
- Filter by mainAction
- Used for creating achievement goals

**POST /admin/action-types** (Phase 2)
- Create new action type
- Validate unique (mainAction, code)

**PATCH /admin/action-types/:id** (Phase 2)
- Update label only (mainAction and code are immutable)

**DELETE /admin/action-types/:id** (Phase 2)
- Delete action type (blocks if used by achievement goals)

## Best Practices

### Naming Conventions

**code Field**:
- Use UPPER_SNAKE_CASE
- Be specific but concise
- Examples: EXPERIENCE, PROFILE_COMPLETE, POST

**label Field**:
- Use title case
- Be human-readable
- Examples: "Experience Post", "Complete Profile"

### When to Create New Action Types

**Create New Type When**:
- Need to track specific user behavior for achievement goals
- Behavior is distinct enough to warrant separate tracking
- Example: LIKE:POST vs LIKE:COMMENT (different engagement patterns)

**Use Existing Type When**:
- Behavior is similar to existing type
- Granularity not needed for current goals
- Example: All post types use POST:GENERAL initially, then split later

### Action Type Lifecycle

```
1. Identify user behavior to track
   ↓
2. Check if existing action type covers it
   ↓
   If yes: Use existing
   If no: Create new action type
   ↓
3. Seed action type via migration (production)
   Or create via admin API (testing)
   ↓
4. Update application services to log action
   ↓
5. Create achievement goals using this action type
   ↓
6. Monitor action log frequency and progress tracking
```

## Analytics Queries

### Most Common Actions

```sql
SELECT
  at.main_action,
  at.code,
  at.label,
  COUNT(*) as action_count
FROM action_logs al
JOIN action_types at ON at.id = al.action_type_id
WHERE al.created_at >= NOW() - INTERVAL '30 days'
GROUP BY at.main_action, at.code, at.label
ORDER BY action_count DESC
LIMIT 10;
```

### Actions Per User

```sql
SELECT
  u.id,
  p.username,
  at.label,
  COUNT(*) as action_count
FROM action_logs al
JOIN users u ON u.id = al.user_id
JOIN profiles p ON p.user_id = u.id
JOIN action_types at ON at.id = al.action_type_id
WHERE al.created_at >= NOW() - INTERVAL '7 days'
GROUP BY u.id, p.username, at.label
ORDER BY action_count DESC
LIMIT 20;
```

### Action Frequency Over Time

```sql
SELECT
  DATE(al.created_at) as date,
  at.main_action,
  COUNT(*) as action_count
FROM action_logs al
JOIN action_types at ON at.id = al.action_type_id
WHERE al.created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(al.created_at), at.main_action
ORDER BY date DESC, action_count DESC;
```

## Migration Strategy

### Adding New Action Types

```sql
-- Phase 2: Granular LIKE tracking
INSERT INTO "action_types" ("id", "main_action", "code", "label", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'LIKE', 'POST', 'Like Post', NOW(), NOW()),
  (gen_random_uuid(), 'LIKE', 'COMMENT', 'Like Comment', NOW(), NOW())
ON CONFLICT (main_action, code) DO NOTHING;

-- Phase 3: SHARE tracking
INSERT INTO "action_types" ("id", "main_action", "code", "label", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'SHARE', 'POST', 'Share Post', NOW(), NOW()),
  (gen_random_uuid(), 'SHARE', 'COLLECTION', 'Share Collection', NOW(), NOW())
ON CONFLICT (main_action, code) DO NOTHING;
```

### Backwards Compatibility

When adding granular types (e.g., LIKE:POST, LIKE:COMMENT), keep LIKE:ALL for backward compatibility:

```typescript
// Track both granular and generic
await actionLogService.logAction({
  userId,
  mainAction: MainAction.LIKE,
  actionTypeCode: 'POST', // Granular
  entityType: 'post',
  entityId: postId,
});

await actionLogService.logAction({
  userId,
  mainAction: MainAction.LIKE,
  actionTypeCode: 'ALL', // Generic (for old achievement goals)
  entityType: 'post',
  entityId: postId,
});
```

---

**Document Version**: 1.0
**Last Updated**: 2026-02-11
**Related Specs**: 04_EARNING_MECHANISMS_SPEC.md, 06_ACTION_LOGGING_SPEC.md
