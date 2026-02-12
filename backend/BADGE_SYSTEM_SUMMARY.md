# Badge & Collection System - Implementation Summary

## Overview
This document summarizes the new Badge and Collection system implementation based on the unified plan (27fac027).

## Badge Types & Mechanisms

### 1. COSMETIC Badge
- **Source**: Marketplace purchases
- **Mechanism**: Listed in marketplace, user purchases → creates UserBadge
- **Service**: Marketplace service (separate from gamification)
- **Independent from**: Actions, events, goals

### 2. EVENT Badge
- **Source**: Event participation with upvote ranking
- **Mechanism**: After event ends, top 1-3 users by `helpfulVotesReceived` receive badges
- **Service**: `EventBadgeDistributorService.distributeEventBadges()`
- **Trigger**: Event end (manual or cron job)
- **Data**: EventBadge with rank (1, 2, 3), EventStats.helpfulVotesReceived
- **Independent from**: Other actions during event

### 3. COLLECTION Badge
- **Source**: Action-based achievement goals in badge collections
- **Mechanism**: User performs actions → progress tracked → badge granted when goal completed
- **Service**: `AchievementProgressService.incrementProgress()`
- **Triggers**:
  - POST: post.service.ts `createFreePost()`
  - LIKE: interaction.service.ts `likePost()`
  - COMMENT: interaction.service.ts `createComment()`
  - BOOKMARK: interaction.service.ts `favoritePost()`
  - JOIN: event.service.ts `joinEvent()`
  - SYSTEM: user.service.ts (profile updates, bio, inventory)
- **Data**:
  - AchievementGoal (collectionId, mainAction, actionTypeId, pointsRequired)
  - UserAchievement (progress tracking)
  - ActionType (mainAction + code, e.g., POST+EXPERIENCE, LIKE+ALL)

### 4. BRAND Badge
- **Source**: Brand-related activities
- **Mechanism**: Existing brand badge logic preserved
- **Service**: Brand-specific services
- **No changes**: Kept as-is from previous system

## Key Services

### EventBadgeDistributorService
- `distributeEventBadges(eventId)`: Distributes badges after event ends
- `getEventBadgeLeaderboard(eventId, limit)`: Preview current standings
- Tiebreaker: Earlier participation (EventStats.createdAt)

### AchievementProgressService
- `incrementProgress(userId, mainAction, actionTypeId, amount)`: Main progress tracking
- `incrementProgressByCode(userId, mainAction, code, amount)`: Helper with ActionType lookup
- `getCollectionProgress(userId, collectionId)`: Get user's collection progress
- Filters: Only COLLECTION type badges

### GamificationService
- `grantBadgeToUser(userId, badgeId)`: Universal badge granting (type-agnostic)
- Idempotent: Won't create duplicate UserBadge
- Sends notification on badge grant

## Database Schema Changes

### New/Updated Models
- **BadgeCollection**: Identity + Strategy + Logic (single table), bannerUrl, categoryId → Category
- **ActionType**: mainAction, code, label (unique on mainAction + code)
- **Badge**: Added collectionId (nullable, FK → BadgeCollection)
- **AchievementGoal**: chainId → collectionId, goalType → mainAction + actionTypeId
- **EventBadge**: Removed requirementType/threshold, added rank (1-3), unique(eventId, rank)

### Removed
- **AchievementChain**: Replaced by BadgeCollection
- **AchievementGoalType enum**: Replaced by MainAction + ActionType

### Enums
- **MainAction**: POST, LIKE, COMMENT, BOOKMARK, JOIN, SYSTEM
- **BadgeType**: COLLECTION (was ACHIEVEMENT), EVENT, COSMETIC, BRAND

## Seed Data

### BadgeCategory (4 records, English)
1. Cosmetic: "Badges available for purchase in the marketplace."
2. Event: "Badges earned during events (e.g. by upvote ranking)."
3. Collection: "Badges earned by completing action-based goals in collections."
4. Brand: "Badges associated with brands."

### ActionType Taxonomy
- POST: EXPERIENCE, TIPS, REVIEW, GENERAL
- LIKE: ALL
- COMMENT: ALL
- BOOKMARK: ALL
- JOIN: ALL
- SYSTEM: PROFILE_COMPLETE, BIO_ADD, INVENTORY_ADD

### Badge Seed Removal
All badge creation/assignment code removed from seed.ts:
- No badges created during seed
- Badges will be added via admin/other channels later

## Migration

**When database is ready:**
```bash
npx prisma migrate dev --name badge_collection_system
```

This will:
- Create BadgeCollection table
- Create ActionType table
- Add collectionId to Badge
- Modify AchievementGoal (collectionId, mainAction, actionTypeId)
- Modify EventBadge (rank instead of requirementType/threshold)
- Drop AchievementChain table
- Update enums (BadgeType, add MainAction)

## Testing Checklist

### Schema & Seed
- [ ] Migration runs successfully
- [ ] BadgeCategory has exactly 4 records (English)
- [ ] ActionType has 11 records
- [ ] No badges created during seed

### Collection Badges
- [ ] POST action increments progress (POST+GENERAL)
- [ ] LIKE action increments progress (LIKE+ALL)
- [ ] COMMENT action increments progress (COMMENT+ALL)
- [ ] BOOKMARK action increments progress (BOOKMARK+ALL)
- [ ] JOIN action increments progress (JOIN+ALL)
- [ ] Progress reaches pointsRequired → Badge granted
- [ ] Only COLLECTION type badges tracked

### Event Badges
- [ ] Event ends → distributeEventBadges() called
- [ ] Top 3 users by helpfulVotesReceived receive badges
- [ ] Rank 1 badge → 1st user, Rank 2 → 2nd user, Rank 3 → 3rd user
- [ ] Tiebreaker works (earlier EventStats.createdAt)
- [ ] UserBadge created with claimed=false

### General
- [ ] Badge notifications sent
- [ ] No duplicate UserBadge created (idempotency)
- [ ] Existing EP posts still work
- [ ] BRAND badges still work (no changes)

## Future Enhancements

1. **SYSTEM Actions**: Add triggers for profile complete, bio add, inventory add
2. **POST Type Specificity**: Use POST+EXPERIENCE, POST+TIPS instead of POST+GENERAL
3. **Event Badge Automation**: Cron job to auto-distribute badges when events end
4. **Collection Completion Bonus**: Implement completion bonus when all badges in collection earned
5. **Nested Categories**: 3-level category nesting for BadgeCollection

## Notes

- Event badges are **independent** from other actions - only upvote ranking matters
- Collection badges track **active actions** (user doing), not passive (receiving likes)
- COSMETIC badges are **marketplace items**, not achievement-based
- All badge types use the same `grantBadgeToUser()` - type-specific logic is in **how** they're earned
