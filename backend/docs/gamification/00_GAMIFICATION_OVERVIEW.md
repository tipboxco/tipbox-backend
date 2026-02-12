# Gamification System Overview

## System Objectives

The Tipbox gamification system is designed to:
1. **Increase Engagement**: Encourage users to actively participate in content creation and community interactions
2. **Improve Retention**: Provide long-term goals and rewards that keep users coming back
3. **Recognize Achievements**: Acknowledge and celebrate user accomplishments
4. **Guide Behavior**: Incentivize valuable contributions through targeted rewards

## Architecture Layers

The gamification system follows Domain-Driven Design (DDD) principles with clear separation of concerns:

### Domain Layer (`backend/src/domain/gamification/`)
Pure business logic with no framework dependencies:
- **Enums**: BadgeType, BadgeRarity, BadgeVisibility, MainAction, AchievementDifficulty
- **Business Rules**: Badge point calculations, rarity multipliers, visibility rules

### Application Layer (`backend/src/application/gamification/`)
Orchestrates domain logic and coordinates use cases:
- **GamificationService**: Core service for badge and collection management
- **AchievementProgressService**: Tracks and updates user progress toward goals
- **ActionLogService**: Logs user actions for audit trail and analytics
- **EventBadgeDistributorService**: Distributes event badges to top performers

### Infrastructure Layer (`backend/src/infrastructure/`)
Technical implementations:
- **Repositories**: Prisma-based data access (`repositories/*-prisma.repository.ts`)
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for performance optimization
- **Queue**: BullMQ for async badge distribution
- **Notifications**: Integration with notification system

### Interface Layer (`backend/src/interfaces/`)
API endpoints and DTOs:
- **User API**: `/api/badges`, `/api/collections`, `/api/profile/*`
- **Admin API**: `/admin/badges`, `/admin/collections`, `/admin/gamification/*`
- **Schemas**: Zod validation for all inputs
- **DTOs**: Structured response formats

## Entity Relationship Diagram

```
User
├─ UserBadge (badges earned by user)
│  ├─ badgeId → Badge
│  ├─ claimed (boolean)
│  ├─ claimedAt (datetime)
│  ├─ isVisible (boolean)
│  ├─ displayOrder (integer, for profile showcase)
│  └─ visibility (PUBLIC, FRIENDS, TRUSTERS, PRIVATE)
│
├─ UserAchievement (progress tracking)
│  ├─ goalId → AchievementGoal
│  ├─ progress (integer, current count)
│  ├─ completed (boolean)
│  └─ completedAt (datetime)
│
└─ ActionLog (audit trail)
   ├─ mainAction (POST, LIKE, COMMENT, etc.)
   ├─ actionTypeId → ActionType
   ├─ entityType (post, comment, event)
   ├─ entityId (UUID of entity)
   └─ metadata (JSON, additional context)

Badge
├─ type (COLLECTION, EVENT, COSMETIC, BRAND)
├─ rarity (COMMON, RARE, EPIC)
├─ categoryId → BadgeCategory
├─ collectionId → BadgeCollection (nullable, for COLLECTION badges)
├─ boostMultiplier (decimal, affects gameplay)
└─ rewardMultiplier (decimal, affects rewards)

BadgeCollection
├─ name, description, bannerUrl
├─ unlockCondition (JSON, prerequisites)
├─ completionBonus (string, reward description)
├─ categoryId → BadgeCategory
└─ achievementGoals → AchievementGoal[]

AchievementGoal
├─ collectionId → BadgeCollection
├─ chainId (UUID, for sequential unlocking)
├─ title, requirement (descriptions)
├─ mainAction → MainAction (POST, LIKE, etc.)
├─ actionTypeId → ActionType (specific action)
├─ rewardBadgeId → Badge (badge earned on completion)
├─ pointsRequired (integer, threshold)
└─ difficulty (EASY, MEDIUM, HARD)

ActionType
├─ mainAction (enum: POST, LIKE, COMMENT, etc.)
├─ code (string: EXPERIENCE, TIPS, ALL, etc.)
├─ label (human-readable)
└─ UNIQUE(mainAction, code)

BadgeCategory
├─ name (Achievement Badges, Event Badges, etc.)
└─ seeded via migrations
```

## Data Flow

### User Action → Progress Tracking → Badge Grant

```
1. User performs action (e.g., creates experience post)
   ↓
2. Application service (PostService) creates post
   ↓
3. Service logs action (ActionLogService.logAction - fire-and-forget)
   ├─ Find ActionType by (mainAction=POST, code=EXPERIENCE)
   └─ Create ActionLog record with metadata
   ↓
4. Service increments progress (AchievementProgressService.incrementProgressByCode - fire-and-forget)
   ├─ Find all AchievementGoals matching this ActionType
   ├─ For each goal:
   │  ├─ Upsert UserAchievement record
   │  ├─ Increment progress counter (atomic)
   │  ├─ Check milestone (25%, 50%, 75%, 90%)
   │  │  └─ Send ACHIEVEMENT_PROGRESS notification
   │  └─ Check completion (progress >= pointsRequired)
   │     ├─ Mark goal as completed
   │     ├─ Grant reward badge (if defined)
   │     └─ Send NEW_BADGE notification
   ↓
5. Badge appears in user's collection (unclaimed)
   ↓
6. User views /api/profile/badges
   ↓
7. User claims badge via POST /api/profile/badges/:badgeId/claim
   ↓
8. Badge marked as claimed, appears in profile showcase
```

### Event Badge Distribution

```
1. Event ends (manual trigger or scheduled)
   ↓
2. Admin or scheduler calls EventBadgeDistributorService.distributeEventBadges(eventId)
   ↓
3. Service fetches EventBadges ordered by rank (1, 2, 3)
   ↓
4. Service fetches EventStats ordered by helpfulVotesReceived (desc)
   ↓
5. For each rank:
   ├─ Rank 1 badge → User with most votes
   ├─ Rank 2 badge → User with 2nd most votes
   └─ Rank 3 badge → User with 3rd most votes
   ↓
6. Badges granted with claimed=false
   ↓
7. Users receive NEW_BADGE notification
   ↓
8. Users claim badges via /api/profile/badges/:badgeId/claim
```

## Integration Points

### Notification System
- **NEW_BADGE**: Sent when badge is granted
- **ACHIEVEMENT_PROGRESS**: Sent at milestones (25%, 50%, 75%, 90%)
- **ACHIEVEMENT_COMPLETED**: Sent when goal is completed
- **COLLECTION_COMPLETED**: Sent when all goals in collection are completed

### Event System
- EventBadgeDistributorService integrates with Event module
- Triggered manually by admin or on scheduled event end
- Uses EventStats to determine top performers

### User Profiles
- Badges displayed on user profile (up to 6 in showcase)
- Badge visibility controlled by user settings
- Badge points contribute to user level

### Content System
- Posts, likes, comments, bookmarks trigger achievement progress
- ActionLog records link to content entities (post, comment, etc.)

## Technology Stack

### Core Technologies
- **Database**: PostgreSQL 15 (relational data)
- **ORM**: Prisma 6.19 (type-safe queries)
- **Cache**: Redis 7 (performance optimization)
- **Queue**: BullMQ 5.62 (async badge distribution)
- **Validation**: Zod 4.2 (input validation)

### Performance Optimizations
- **Async Actions**: Action logging and progress tracking are fire-and-forget
- **Indexes**: Strategic indexes on UserBadge, UserAchievement, ActionLog
- **Caching**: Badge and collection data cached in Redis
- **Batch Operations**: Bulk badge grants and backfill operations use batching
- **Transactions**: Multi-step operations wrapped in database transactions

### Monitoring & Observability
- **Logging**: Winston logger for all operations
- **Metrics**: Track badge grant rates, completion rates, action frequencies
- **Admin Analytics**: Dashboard for gamification health metrics

## Key Design Decisions

### 1. Fire-and-Forget Action Tracking
**Decision**: Action logging and progress tracking are asynchronous and non-blocking.

**Rationale**: User actions (creating posts, liking content) should not be slowed down by gamification tracking. If tracking fails, it logs a warning but doesn't fail the user action.

**Tradeoff**: Small risk of missed progress updates, but ensures fast user experience.

### 2. Unclaimed Badge State
**Decision**: Badges start in unclaimed state and require explicit user claim.

**Rationale**: Creates engagement opportunity, allows users to discover new badges, prevents overwhelming users with notifications.

**Implementation**: `UserBadge.claimed = false` by default, user must call `/api/profile/badges/:badgeId/claim`.

### 3. Milestone Notifications
**Decision**: Send progress notifications at 25%, 50%, 75%, 90% milestones.

**Rationale**: Keeps users engaged, provides positive reinforcement, encourages completion.

**Implementation**: Checked during `incrementProgress`, notifications sent via NotificationService.

### 4. Flexible Action Types
**Decision**: ActionType uses (mainAction, code) tuple for extensibility.

**Rationale**: Allows granular tracking (POST:EXPERIENCE vs POST:TIPS) while maintaining backward compatibility. New action types can be added without schema changes.

**Example**:
- `(POST, EXPERIENCE)` → Creating experience posts
- `(POST, TIPS)` → Creating tip posts
- `(LIKE, ALL)` → Liking any content
- `(LIKE, POST)` → (Future) Liking posts specifically

### 5. Idempotent Badge Grants
**Decision**: Unique constraint on (userId, badgeId) prevents duplicate badges.

**Rationale**: Ensures data integrity, simplifies service logic (no need to check before granting).

**Implementation**: Database constraint, service handles duplicate errors gracefully.

### 6. Collection-Based Achievement Organization
**Decision**: AchievementGoals are grouped into BadgeCollections.

**Rationale**: Provides structure, allows thematic grouping, enables unlock conditions and completion bonuses.

**Example**: "Content Creator" collection with goals for posting experiences, tips, reviews.

## Security Considerations

### Authentication & Authorization
- User endpoints require `authMiddleware`
- Admin endpoints require `authMiddleware` + `requireAdmin`
- User can only modify their own badges/progress

### Input Validation
- All inputs validated with Zod schemas
- UUIDs validated for proper format
- Pagination limits enforced (max 100 per page)

### Data Access Control
- Badge visibility respected in all queries (PUBLIC, FRIENDS, TRUSTERS, PRIVATE)
- Users cannot view other users' unclaimed badges
- Admin logs record all administrative actions

### Rate Limiting
- Action logging doesn't block user actions (fire-and-forget)
- Bulk operations (badge grants, backfill) should be admin-only

## Future Enhancements

### Phase 2 Features
- **Leaderboards**: Top badge earners, fastest completions
- **Badge Trading**: Allow users to trade COSMETIC badges
- **Achievement Chains**: Sequential unlocking (complete A to unlock B)
- **Time-Limited Badges**: Seasonal or event-specific badges
- **Social Sharing**: Share badge achievements to social media
- **Badge Showcase Customization**: More than 6 badges, custom ordering
- **Granular Action Types**: Separate LIKE:POST from LIKE:COMMENT tracking

### Analytics Enhancements
- **Completion Funnels**: Track drop-off rates for achievement goals
- **Engagement Metrics**: Badge impact on user retention and activity
- **A/B Testing**: Test different badge designs, rewards, difficulty levels
- **Predictive Analytics**: Suggest badges to users based on behavior

### Performance Improvements
- **Action Log Partitioning**: Partition by month for faster queries
- **Materialized Views**: Pre-computed leaderboards and stats
- **GraphQL API**: More efficient data fetching for admin panel
- **Real-time Updates**: WebSocket notifications for badge grants

---

**Document Version**: 1.0
**Last Updated**: 2026-02-11
**Owner**: Tipbox Backend Team
