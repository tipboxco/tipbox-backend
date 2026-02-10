# Collection System Specification

## Overview

Badge Collections are thematic groups of Achievement Goals that guide users toward earning related badges. Collections provide structure to the gamification system, creating clear progression paths and rewarding comprehensive achievement.

## Collection Structure

### Database Schema

```prisma
model BadgeCollection {
  id                String   @id @default(uuid()) @db.Uuid
  name              String   @db.VarChar(500)
  bannerUrl         String?  @map("banner_url") @db.VarChar(1000)
  owner             String?  @db.VarChar(500)
  focusSector       String?  @map("focus_sector") @db.VarChar(500)
  targetGroup       String?  @map("target_group") @db.VarChar(500)
  shortDescription  String?  @map("short_description") @db.VarChar(2000)
  longDescription   String?  @map("long_description") @db.VarChar(5000)
  unlockCondition   String?  @map("unlock_condition") @db.VarChar(1000)
  completionBonus   String?  @map("completion_bonus") @db.VarChar(500)
  categoryId        String?  @map("category_id") @db.Uuid
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  category         BadgeCategory?    @relation(fields: [categoryId], references: [id])
  badges           Badge[]
  achievementGoals AchievementGoal[]

  @@map("badge_collections")
}
```

### Field Descriptions

**name** (String, 1-500 chars, Required)
- Display name of the collection
- Should be thematic and descriptive
- Examples: "Content Creator", "Social Butterfly", "Event Champion"

**bannerUrl** (String, URL, Nullable)
- URL to collection banner image
- Recommended size: 1200x400px
- Stored in MinIO/S3
- Used in collection detail view

**owner** (String, max 500 chars, Nullable)
- Entity that created/owns the collection
- Examples: "Tipbox Team", "Nike Brand Partnership", "Community"
- Used for attribution and trust

**focusSector** (String, max 500 chars, Nullable)
- Primary activity area of the collection
- Examples: "Content Creation", "Social Engagement", "Event Participation"
- Used for filtering and recommendations

**targetGroup** (String, max 500 chars, Nullable)
- Intended user demographic
- Examples: "Active Posters", "New Users", "Power Users"
- Used for personalization and recommendations

**shortDescription** (String, max 2000 chars, Nullable)
- Brief description for collection list views
- Should explain theme and main goals
- Example: "Master the art of experience sharing by creating diverse content and engaging with the community."

**longDescription** (String, max 5000 chars, Nullable)
- Detailed description for collection detail view
- Can include markdown formatting
- Should explain:
  - What the collection represents
  - How to complete it
  - Benefits of completion
  - Tips for success

**unlockCondition** (String, max 1000 chars, Nullable)
- JSON string defining prerequisites
- See Unlock Conditions section below
- Null = unlocked for all users

**completionBonus** (String, max 500 chars, Nullable)
- Description of reward for completing all goals
- Examples: "+100 points", "Exclusive Badge", "Profile Flair"
- Not programmatically enforced (description only)

**categoryId** (UUID, Nullable)
- Links to BadgeCategory
- Used for organization and filtering
- Can be null for uncategorized collections

## Achievement Goals

Each collection contains multiple AchievementGoals that define specific tasks users must complete.

### Database Schema

```prisma
model AchievementGoal {
  id             String                 @id @default(uuid()) @db.Uuid
  collectionId   String                 @map("collection_id") @db.Uuid
  chainId        String?                @map("chain_id") @db.Uuid
  title          String?                @db.VarChar(500)
  requirement    String?                @db.VarChar(1000)
  mainAction     MainAction             @map("main_action")
  actionTypeId   String                 @map("action_type_id") @db.Uuid
  rewardBadgeId  String?                @map("reward_badge_id") @db.Uuid
  pointsRequired Int                    @map("points_required") @db.Integer
  difficulty     AchievementDifficulty
  createdAt      DateTime               @default(now()) @map("created_at")

  collection       BadgeCollection    @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  actionType       ActionType         @relation(fields: [actionTypeId], references: [id])
  rewardBadge      Badge?             @relation(fields: [rewardBadgeId], references: [id])
  userAchievements UserAchievement[]

  @@map("achievement_goals")
}
```

### Field Descriptions

**collectionId** (UUID, Required)
- Links to parent BadgeCollection
- Cascade delete: Deleting collection deletes all its goals

**chainId** (UUID, Nullable)
- Links to another AchievementGoal that must be completed first
- Enables sequential unlocking
- Example: "Create 10 posts" unlocks "Create 50 posts"

**title** (String, max 500 chars, Optional)
- Human-readable goal title
- Example: "Experience Sharing Beginner"
- If null, use requirement field

**requirement** (String, max 1000 chars, Optional)
- Description of what user must do
- Example: "Create 10 experience posts to earn this badge"
- Can include markdown formatting

**mainAction** (MainAction Enum, Required)
- Category of action being tracked
- Values: POST, LIKE, COMMENT, BOOKMARK, JOIN, SHARE, SYSTEM
- Used to find matching user actions

**actionTypeId** (UUID, Required)
- Links to specific ActionType
- Example: ActionType(mainAction=POST, code=EXPERIENCE)
- Determines which actions increment progress

**rewardBadgeId** (UUID, Nullable)
- Badge earned when goal is completed
- Null = no badge reward (progress-only goal)
- Badge is granted automatically on completion

**pointsRequired** (Integer, Required)
- Threshold for goal completion
- Example: 10 means user must perform action 10 times
- Minimum: 1

**difficulty** (AchievementDifficulty Enum, Required)
- Subjective difficulty level
- Values: EASY, MEDIUM, HARD
- Affects completion bonus multiplier
- Used for UI visual treatment

## Difficulty Levels

### EASY
- **Points Range**: 1-10 actions
- **Completion Time**: Days to 1 week
- **Completion Bonus Multiplier**: 1.0x
- **Visual**: Green color scheme
- **Examples**:
  - "Create your first post"
  - "Like 5 posts"
  - "Complete your profile"

### MEDIUM
- **Points Range**: 11-50 actions
- **Completion Time**: 1-4 weeks
- **Completion Bonus Multiplier**: 1.5x
- **Visual**: Blue color scheme
- **Examples**:
  - "Create 25 experience posts"
  - "Receive 100 likes"
  - "Comment on 50 posts"

### HARD
- **Points Range**: 51+ actions
- **Completion Time**: 1+ months
- **Completion Bonus Multiplier**: 2.0x
- **Visual**: Red/orange color scheme
- **Examples**:
  - "Create 100 posts"
  - "Receive 1000 likes"
  - "Complete 10 collections"

## Collection Progress Tracking

### Per-User Progress

Progress is tracked via UserAchievement records (one per user per goal).

```typescript
interface CollectionProgress {
  collectionId: string;
  userId: string;
  completedGoals: number;      // Count of completed goals
  totalGoals: number;           // Total goals in collection
  percentage: number;           // (completedGoals / totalGoals) * 100
  isCompleted: boolean;         // completedGoals === totalGoals && totalGoals > 0
  goals: Array<{
    goalId: string;
    title: string;
    requirement: string;
    progress: number;           // Current count (e.g., 7 posts created)
    pointsRequired: number;     // Target count (e.g., 10 posts)
    percentage: number;         // (progress / pointsRequired) * 100
    completed: boolean;
    completedAt: Date | null;
  }>;
}
```

### Progress Calculation

```typescript
async function getCollectionProgress(userId: string, collectionId: string) {
  const collection = await prisma.badgeCollection.findUnique({
    where: { id: collectionId },
    include: {
      achievementGoals: {
        include: {
          userAchievements: {
            where: { userId },
          },
        },
      },
    },
  });

  const goals = collection.achievementGoals.map((goal) => {
    const userAchievement = goal.userAchievements[0] || null;
    const progress = userAchievement?.progress || 0;
    const percentage = (progress / goal.pointsRequired) * 100;

    return {
      goalId: goal.id,
      title: goal.title || goal.requirement,
      requirement: goal.requirement,
      progress,
      pointsRequired: goal.pointsRequired,
      percentage,
      completed: userAchievement?.completed || false,
      completedAt: userAchievement?.completedAt || null,
    };
  });

  const completedGoals = goals.filter((g) => g.completed).length;
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

## Unlock Conditions

Collections can have prerequisites defined in JSON format in the `unlockCondition` field.

### Badge Prerequisite

Requires user to have earned a specific badge:

```json
{
  "type": "badge_required",
  "requiredBadgeId": "uuid-of-badge",
  "badgeName": "First Post"
}
```

**Validation**:
```typescript
async function checkBadgeUnlock(userId: string, requiredBadgeId: string): Promise<boolean> {
  const userBadge = await prisma.userBadge.findFirst({
    where: { userId, badgeId: requiredBadgeId, claimed: true },
  });
  return !!userBadge;
}
```

### Collection Prerequisite

Requires user to have completed another collection:

```json
{
  "type": "collection_completed",
  "requiredCollectionId": "uuid-of-collection",
  "collectionName": "Content Creator Basics"
}
```

**Validation**:
```typescript
async function checkCollectionUnlock(userId: string, requiredCollectionId: string): Promise<boolean> {
  const collection = await prisma.badgeCollection.findUnique({
    where: { id: requiredCollectionId },
    include: {
      achievementGoals: {
        include: {
          userAchievements: { where: { userId } },
        },
      },
    },
  });

  const totalGoals = collection.achievementGoals.length;
  const completedGoals = collection.achievementGoals.filter((g) =>
    g.userAchievements.some((ua) => ua.completed)
  ).length;

  return totalGoals > 0 && completedGoals === totalGoals;
}
```

### Level Requirement

Requires user to reach a specific level:

```json
{
  "type": "level_required",
  "minLevel": 5
}
```

**Validation**:
```typescript
async function checkLevelUnlock(userId: string, minLevel: number): Promise<boolean> {
  const stats = await gamificationService.getUserGamificationStats(userId);
  return stats.level >= minLevel;
}
```

### Multiple Conditions (AND Logic)

```json
{
  "type": "all_required",
  "conditions": [
    {
      "type": "level_required",
      "minLevel": 3
    },
    {
      "type": "badge_required",
      "requiredBadgeId": "uuid-of-badge"
    }
  ]
}
```

### Multiple Conditions (OR Logic)

```json
{
  "type": "any_required",
  "conditions": [
    {
      "type": "badge_required",
      "requiredBadgeId": "uuid-of-badge-1"
    },
    {
      "type": "badge_required",
      "requiredBadgeId": "uuid-of-badge-2"
    }
  ]
}
```

## Collection Completion Flow

```
1. User views collection
   ↓
2. Check unlock conditions
   ↓
   If locked: Show lock icon and requirement message
   If unlocked: Show goals and progress
   ↓
3. User performs actions (create posts, like content, etc.)
   ↓
4. AchievementProgressService increments progress for matching goals
   ↓
5. Goal completed → Badge granted → Notification sent
   ↓
6. Check collection completion
   ↓
   If all goals completed:
   - Mark collection as completed
   - Award completion bonus (if defined)
   - Send COLLECTION_COMPLETED notification
   - Check if this unlocks other collections
```

## Example Collections

### Content Creator Collection

```typescript
{
  name: "Content Creator",
  shortDescription: "Master the art of content creation on Tipbox",
  focusSector: "Content Creation",
  targetGroup: "Active Posters",
  unlockCondition: null, // Available to all users
  completionBonus: "+200 points and exclusive Content Master badge",
  goals: [
    {
      title: "First Post",
      requirement: "Create your first post",
      mainAction: "POST",
      actionTypeCode: "GENERAL",
      pointsRequired: 1,
      difficulty: "EASY",
      rewardBadge: "First Post Badge",
    },
    {
      title: "Experience Sharer",
      requirement: "Create 10 experience posts",
      mainAction: "POST",
      actionTypeCode: "EXPERIENCE",
      pointsRequired: 10,
      difficulty: "MEDIUM",
      rewardBadge: "Experience Sharer Badge",
    },
    {
      title: "Tips Master",
      requirement: "Create 25 tips posts",
      mainAction: "POST",
      actionTypeCode: "TIPS",
      pointsRequired: 25,
      difficulty: "HARD",
      rewardBadge: "Tips Master Badge",
    },
  ],
}
```

### Social Butterfly Collection

```typescript
{
  name: "Social Butterfly",
  shortDescription: "Engage with the Tipbox community",
  focusSector: "Social Engagement",
  targetGroup: "Active Users",
  unlockCondition: JSON.stringify({
    type: "badge_required",
    requiredBadgeId: "first-post-badge-id",
    badgeName: "First Post",
  }),
  completionBonus: "Social Champion badge and +150 points",
  goals: [
    {
      title: "Like Enthusiast",
      requirement: "Like 50 posts",
      mainAction: "LIKE",
      actionTypeCode: "ALL",
      pointsRequired: 50,
      difficulty: "EASY",
      rewardBadge: "Like Enthusiast Badge",
    },
    {
      title: "Comment Champion",
      requirement: "Write 100 comments",
      mainAction: "COMMENT",
      actionTypeCode: "ALL",
      pointsRequired: 100,
      difficulty: "MEDIUM",
      rewardBadge: "Comment Champion Badge",
    },
    {
      title: "Bookmark Master",
      requirement: "Bookmark 25 posts",
      mainAction: "BOOKMARK",
      actionTypeCode: "ALL",
      pointsRequired: 25,
      difficulty: "EASY",
      rewardBadge: "Bookmark Master Badge",
    },
  ],
}
```

## API Endpoints Summary

### User Endpoints

**GET /api/collections**
- List all collections
- Filter by category, search term
- Include user progress if authenticated
- Pagination support

**GET /api/collections/:id**
- Get collection details
- Include all goals with user progress
- Show unlock status
- Show completion percentage

### Admin Endpoints

**GET /admin/collections**
- List all collections with management options
- Show completion statistics

**POST /admin/collections**
- Create new collection

**PATCH /admin/collections/:id**
- Update collection metadata

**DELETE /admin/collections/:id**
- Delete collection (cascade deletes goals)

**GET /admin/collections/:id/goals**
- List goals in collection

**POST /admin/collections/:id/goals**
- Add new goal to collection

**PATCH /admin/goals/:id**
- Update goal

**DELETE /admin/goals/:id**
- Delete goal

## Best Practices

### Collection Design

**Thematic Cohesion**:
- All goals should relate to collection theme
- Example: "Content Creator" should only have content-related goals

**Progressive Difficulty**:
- Order goals from EASY to HARD
- Use chainId for sequential unlocking
- Example: Complete "First Post" before "100 Posts"

**Balanced Goal Count**:
- 3-7 goals per collection (ideal: 5)
- Too few: Feels incomplete
- Too many: Overwhelming

**Clear Requirements**:
- Use specific numbers: "Create 10 posts", not "Create many posts"
- Explain context: "Create 10 experience posts to share your travels"

### Unlock Condition Design

**Gradual Unlocking**:
- Basic collections: No unlock condition
- Intermediate collections: Require completing basic collection
- Advanced collections: Require multiple prerequisites

**Avoid Circular Dependencies**:
- Collection A should not require Collection B if B requires A
- Validate unlock chains before saving

**Transparent Requirements**:
- Always include descriptive field names in JSON
- Example: Include "badgeName" in addition to "requiredBadgeId"

### Completion Bonus Design

**Be Specific**:
- Good: "+200 points and exclusive Content Master badge"
- Bad: "Special reward"

**Make It Valuable**:
- Completion should feel worthwhile
- Consider: Exclusive badge, large point bonus, profile flair

**Programmatic vs Descriptive**:
- Current implementation: Descriptive only (manual fulfillment)
- Future enhancement: Programmatic bonus awarding

## Analytics & Metrics

### Collection Metrics

**Completion Rate**:
```sql
SELECT
  c.id,
  c.name,
  COUNT(DISTINCT ua.user_id) as unique_users,
  COUNT(DISTINCT CASE WHEN ua.completed THEN ua.user_id END) as completed_users,
  (COUNT(DISTINCT CASE WHEN ua.completed THEN ua.user_id END)::FLOAT /
   NULLIF(COUNT(DISTINCT ua.user_id), 0)) * 100 as completion_rate
FROM badge_collections c
JOIN achievement_goals ag ON ag.collection_id = c.id
JOIN user_achievements ua ON ua.goal_id = ag.id
GROUP BY c.id, c.name;
```

**Average Time to Complete**:
```sql
SELECT
  c.id,
  c.name,
  AVG(EXTRACT(EPOCH FROM (ua.completed_at - ua.created_at)) / 86400) as avg_days_to_complete
FROM badge_collections c
JOIN achievement_goals ag ON ag.collection_id = c.id
JOIN user_achievements ua ON ua.goal_id = ag.id
WHERE ua.completed = true
GROUP BY c.id, c.name;
```

**Drop-off Points**:
- Track which goals have lowest completion rates
- Adjust difficulty or points required if too hard

---

**Document Version**: 1.0
**Last Updated**: 2026-02-11
**Related Specs**: 01_BADGE_SYSTEM_SPEC.md, 05_PROGRESS_TRACKING_SPEC.md
