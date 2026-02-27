# Badge Collection System - Flexibility & Activity Tracking Analysis

**Date:** 2026-02-12
**Author:** System Analysis
**Version:** 1.0
**Status:** Active Development

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [ESSENTIALS Collection Case Study](#essentials-collection-case-study)
4. [Backend Infrastructure Analysis](#backend-infrastructure-analysis)
5. [Admin Panel Capabilities](#admin-panel-capabilities)
6. [Critical Gaps & Missing Features](#critical-gaps--missing-features)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Technical Recommendations](#technical-recommendations)
9. [Appendix](#appendix)

---

## 📊 Executive Summary

### Current System Status

The Tipbox badge collection system has a **solid backend infrastructure** with **automatic activity tracking** capabilities, but faces **critical gaps in the admin panel UI** that prevent non-technical users from creating and managing badge collections without developer intervention.

### Flexibility Score: **4.9/10**

| Component | Score | Status |
|-----------|-------|--------|
| Backend Tracking Infrastructure | 9/10 | ✅ Excellent |
| Activity Integration Coverage | 6/10 | ⚠️ Partial |
| Admin Collection Management | 8/10 | ✅ Good |
| **Admin Goal Management** | **2/10** | **❌ Critical Gap** |
| Admin ActionType Management | 3/10 | ❌ Limited |
| Prerequisite Support | 1/10 | ❌ Missing |
| Reverse Tracking | 0/10 | ❌ Not Implemented |
| Progress Monitoring | 4/10 | ⚠️ Backend Only |

### Key Findings

✅ **Strengths:**
- Centralized, automatic activity tracking system
- Well-designed database schema with proper relations
- Automatic badge granting when goals are completed
- Comprehensive REST API for all operations

❌ **Critical Issues:**
- **No Admin UI for Goal Management** (API exists but no interface)
- SYSTEM action tracking incomplete (profile updates, follows)
- No prerequisite badge support
- No reverse tracking (e.g., "get bookmarked by others")
- Limited ActionType management

### Impact on ESSENTIALS Collection

The proposed **ESSENTIALS collection** (14 badges):
- **60% Ready** - Can create collection, badges, and basic tracking
- **40% Missing** - Requires manual SQL for goals, code changes for SYSTEM actions, no prerequisite support

---

## 🏗️ System Architecture Overview

### Current Badge Collection Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User Performs Action                      │
│              (POST, LIKE, COMMENT, BOOKMARK, etc.)          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  ActionLogService.logAction()                │
│           Logs raw event to ActionLog table                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         AchievementProgressService.incrementProgress()       │
│  - Finds matching AchievementGoals                          │
│  - Increments UserAchievement.progress                      │
│  - Checks if pointsRequired reached                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
                   ┌─────────┐
                   │Progress │
                   │Complete?│
                   └────┬────┘
                        │
           ┌────────────┴────────────┐
           │ NO                      │ YES
           ▼                         ▼
    Continue tracking    ┌───────────────────────┐
                         │ GamificationService   │
                         │ .grantBadgeToUser()   │
                         │                       │
                         │ - Create UserBadge    │
                         │ - Send Notification   │
                         └───────────────────────┘
```

### Database Schema (Relevant Models)

```
BadgeCollection
├── id: UUID
├── name: String
├── bannerUrl: String?
├── owner: String?
├── focusSector: String?
├── targetGroup: String?
├── shortDescription: String?
├── longDescription: String?
├── unlockCondition: String?
├── completionBonus: String?
├── categoryId: UUID?
└── Relations:
    ├── badges: Badge[]
    └── achievementGoals: AchievementGoal[]

Badge
├── id: UUID
├── name: String
├── description: String?
├── imageUrl: String?
├── type: BadgeType (COLLECTION, EVENT, COSMETIC, BRAND)
├── rarity: BadgeRarity (COMMON, RARE, EPIC)
├── boostMultiplier: Float?
├── rewardMultiplier: Float?
├── categoryId: UUID
├── collectionId: UUID?
└── Relations:
    ├── userBadges: UserBadge[]
    └── achievementGoals: AchievementGoal[]

AchievementGoal
├── id: UUID
├── collectionId: UUID
├── chainId: UUID?
├── title: String
├── requirement: String
├── mainAction: MainAction
├── actionTypeId: UUID
├── rewardBadgeId: UUID?
├── pointsRequired: Int
├── difficulty: AchievementDifficulty
└── Relations:
    ├── collection: BadgeCollection
    ├── actionType: ActionType
    ├── rewardBadge: Badge?
    └── userAchievements: UserAchievement[]

ActionType
├── id: UUID
├── mainAction: MainAction
├── code: String
├── label: String
└── Unique: [mainAction, code]

UserAchievement
├── id: UUID
├── userId: UUID
├── goalId: UUID
├── progress: Int
├── completed: Boolean
├── completedAt: DateTime?
└── Relations:
    ├── user: User
    └── goal: AchievementGoal

UserBadge
├── id: UUID
├── userId: UUID
├── badgeId: UUID
├── isVisible: Boolean
├── displayOrder: Int?
├── visibility: BadgeVisibility
├── claimed: Boolean
├── claimedAt: DateTime?
└── Relations:
    ├── user: User
    └── badge: Badge
```

### Supported MainAction Types

```typescript
enum MainAction {
  POST = 'POST',       // Creating posts (tips, questions, benchmarks, etc.)
  LIKE = 'LIKE',       // Liking posts
  COMMENT = 'COMMENT', // Commenting on posts
  BOOKMARK = 'BOOKMARK', // Bookmarking/favoriting posts
  JOIN = 'JOIN',       // Joining events, brands
  SYSTEM = 'SYSTEM'    // System actions (profile updates, inventory, etc.)
}
```

Each MainAction can have multiple ActionType codes:
- `POST + TIP` → Creating a tip post
- `POST + QUESTION` → Creating a question post
- `LIKE + ALL` → Liking any post
- `SYSTEM + INVENTORY_ADD` → Adding item to inventory
- `SYSTEM + AVATAR_UPLOAD` → Uploading avatar (not yet implemented)

---

## 🎯 ESSENTIALS Collection Case Study

### Collection Metadata

- **Name:** ESSENTIALS
- **Focus Sector:** None
- **Description:** "In this world, you don't just consume content; you create, compare, and guide. This collection is designed to transform you from a silent user into a recognized actor."
- **Owner:** Aycan K.
- **Total Badges:** 14

### Badge Breakdown

| # | Badge Name | Action Type | Target | Progress Goal | System Support |
|---|-----------|-------------|---------|---------------|----------------|
| 1 | **Bio-Hacker** | SYSTEM | Avatar + Bio | Complete | ❌ No tracking |
| 2 | **Vault Keeper** | SYSTEM | Inventory | 5 Items | ✅ Ready |
| 3 | **Icebreaker** | POST | Free Post | 1 Post | ✅ Ready |
| 4 | **Seeker** | POST | Question | 1 Post | ✅ Ready |
| 5 | **Pathfinder** | POST | Tip & Trick | 1 Tip | ✅ Ready |
| 6 | **Spec Analyst** | POST | Benchmark | 1 Post | ⚠️ Needs prerequisite |
| 7 | **Scout** | SYSTEM | Product Test | 1 Item | ⚠️ Unclear tracking |
| 8 | **Refiner** | POST | Update Post | 1 Update | ⚠️ Check tracking |
| 9 | **Social Navigator** | LIKE | Like/Comment | 10 Actions | ✅ Ready |
| 10 | **Gem Hunter** | BOOKMARK | Save Posts | 3 Saves | ✅ Ready |
| 11 | **Brand Ally** | JOIN | Brand | 1 Brand | ✅ Ready |
| 12 | **Event Hunter** | JOIN | Event | 1 Event | ✅ Ready |
| 13 | **Opinion Leader** | BOOKMARK | Get Saved | 3 Saves | ❌ No reverse tracking |
| 14 | **Trust Agent** | SYSTEM | Follow User | 1 User | ❌ No tracking + prerequisite |

### Prerequisites

- **Spec Analyst** requires **Vault Keeper** badge
- **Trust Agent** requires **Bio-Hacker** badge

**Current System:** ❌ No prerequisite badge support

---

## 🔧 Backend Infrastructure Analysis

### ✅ Strengths

#### 1. Centralized Activity Tracking

**Location:** All service files integrate with tracking system

**Implementation Pattern:**
```typescript
// Example: interaction.service.ts (likePost method)
async likePost(userId: string, postId: string) {
  // ... business logic

  // 1. Log the action (fire-and-forget)
  this.actionLogService.logAction({
    userId,
    mainAction: MainAction.LIKE,
    actionTypeCode: 'ALL',
    entityType: 'post',
    entityId: postId,
    metadata: { postType: post.type, authorId: post.userId }
  }).catch(err => logger.warn('Failed to log like action'));

  // 2. Increment collection badge progress
  this.achievementProgressService.incrementProgressByCode(
    userId,
    MainAction.LIKE,
    'ALL',
    1
  ).catch(err => logger.warn('Failed to increment progress'));
}
```

**Integration Points:**
- ✅ `src/application/post/post.service.ts` - POST actions
- ✅ `src/application/interaction/interaction.service.ts` - LIKE, COMMENT, BOOKMARK
- ✅ `src/application/inventory/inventory.service.ts` - INVENTORY_ADD
- ✅ `src/application/event/event.service.ts` - JOIN (events)
- ❌ `src/application/user/user.service.ts` - **NO TRACKING**

#### 2. Automatic Badge Granting

**Service:** `AchievementProgressService`

**Flow:**
```typescript
async incrementProgress(userId, mainAction, actionTypeId, amount = 1) {
  // Find matching goals
  const goals = await this.findGoalsByAction(mainAction, actionTypeId);

  for (const goal of goals) {
    // Update or create UserAchievement
    const progress = existingProgress + amount;
    const completed = progress >= goal.pointsRequired;

    if (completed && goal.rewardBadgeId) {
      // Automatically grant badge (idempotent)
      await this.gamificationService.grantBadgeToUser(
        userId,
        goal.rewardBadgeId
      );

      logger.info('Badge granted', { userId, badgeId: goal.rewardBadgeId });
    }
  }
}
```

**Features:**
- ✅ Milestone notifications (25%, 50%, 75%, 90%)
- ✅ Idempotent badge granting (no duplicates)
- ✅ Automatic notification to user
- ✅ Fire-and-forget pattern (doesn't block main flow)

#### 3. Flexible ActionType System

**Database Constraint:** Unique combination of `[mainAction, code]`

**Examples:**
```sql
-- Existing (working)
INSERT INTO action_types (main_action, code, label) VALUES
  ('POST', 'TIP', 'Tip & Trick Post'),
  ('POST', 'QUESTION', 'Question Post'),
  ('LIKE', 'ALL', 'Like Post'),
  ('BOOKMARK', 'ALL', 'Bookmark Post'),
  ('SYSTEM', 'INVENTORY_ADD', 'Add to Inventory');

-- Missing (needed for ESSENTIALS)
INSERT INTO action_types (main_action, code, label) VALUES
  ('SYSTEM', 'AVATAR_UPLOAD', 'Upload Avatar'),
  ('SYSTEM', 'BIO_COMPLETE', 'Complete Bio'),
  ('SYSTEM', 'FOLLOW_USER', 'Follow User'),
  ('BOOKMARK', 'RECEIVED', 'Post Bookmarked by Others');
```

### ⚠️ Weaknesses

#### 1. SYSTEM Action Tracking Incomplete

**Missing Integrations:**

**A) User Profile Service**
```typescript
// Current: src/application/user/user.service.ts
async updateProfile(userId, data) {
  // ... update profile in database
  // ❌ NO TRACKING!
}

// Required:
async updateProfile(userId, data) {
  const updates = await prisma.profile.update({ ... });

  // Track avatar upload
  if (data.avatar) {
    await this.actionLogService.logAction({
      userId,
      mainAction: MainAction.SYSTEM,
      actionTypeCode: 'AVATAR_UPLOAD',
      entityType: 'profile',
      entityId: userId
    });
    await this.achievementProgressService.incrementProgressByCode(
      userId, MainAction.SYSTEM, 'AVATAR_UPLOAD', 1
    );
  }

  // Track bio completion
  if (data.bio && data.bio.length > 10) {
    await this.actionLogService.logAction({
      userId,
      mainAction: MainAction.SYSTEM,
      actionTypeCode: 'BIO_COMPLETE',
      entityType: 'profile',
      entityId: userId
    });
    await this.achievementProgressService.incrementProgressByCode(
      userId, MainAction.SYSTEM, 'BIO_COMPLETE', 1
    );
  }

  return updates;
}
```

**Impact:**
- ❌ **Bio-Hacker** badge cannot be earned
- ❌ **Trust Agent** prerequisite cannot be satisfied

**B) Follow/Trust System**

**Status:** Unknown if follow system exists. Requires investigation.

**Required:**
```typescript
async followUser(followerId, followedId) {
  // ... create follow relation

  await this.actionLogService.logAction({
    userId: followerId,
    mainAction: MainAction.SYSTEM,
    actionTypeCode: 'FOLLOW_USER',
    entityType: 'user',
    entityId: followedId
  });

  await this.achievementProgressService.incrementProgressByCode(
    followerId, MainAction.SYSTEM, 'FOLLOW_USER', 1
  );
}
```

#### 2. Reverse Tracking Not Implemented

**Problem:** Some badges require tracking actions **received** by user, not actions **performed** by user.

**Example: Opinion Leader Badge**
- **Requirement:** "Your posts get bookmarked by others (3 times)"
- **Current:** Only tracks when **you** bookmark others' posts
- **Needed:** Track when **others** bookmark **your** posts

**Solution:**
```typescript
// src/application/interaction/interaction.service.ts
async favoritePost(userId: string, postId: string) {
  const post = await this.contentPostRepo.findById(postId);

  // ... create favorite

  // Track for the user who bookmarked (existing)
  await this.actionLogService.logAction({
    userId,
    mainAction: MainAction.BOOKMARK,
    actionTypeCode: 'ALL',
    entityType: 'post',
    entityId: postId
  });
  await this.achievementProgressService.incrementProgressByCode(
    userId, MainAction.BOOKMARK, 'ALL', 1
  );

  // 🆕 TRACK FOR POST OWNER (reverse tracking)
  await this.actionLogService.logAction({
    userId: post.userId, // Post owner!
    mainAction: MainAction.BOOKMARK,
    actionTypeCode: 'RECEIVED',
    entityType: 'post',
    entityId: postId,
    metadata: { bookmarkedBy: userId }
  });
  await this.achievementProgressService.incrementProgressByCode(
    post.userId,
    MainAction.BOOKMARK,
    'RECEIVED',
    1
  );
}
```

**Required Changes:**
1. Create new ActionType: `BOOKMARK + RECEIVED`
2. Update `favoritePost()` method
3. Similar logic for LIKE (if needed for future badges)

#### 3. No Prerequisite Badge Support

**Current State:**
- ❌ No `prerequisiteBadgeId` field in Badge or AchievementGoal models
- ❌ No validation in `AchievementProgressService`
- ❌ No UI in admin panel

**Workaround:**
- Use `unlockCondition` text field for information only
- Manual validation by admin

**Required Implementation:**

**A) Schema Migration:**
```prisma
model AchievementGoal {
  // ... existing fields
  prerequisiteBadgeId String? @map("prerequisite_badge_id") @db.Uuid
  prerequisiteBadge   Badge?  @relation("PrerequisiteBadge", fields: [prerequisiteBadgeId], references: [id])
}
```

**B) Service Logic:**
```typescript
// src/application/gamification/achievement-progress.service.ts
async incrementProgress(userId, mainAction, actionTypeId, amount) {
  const goals = await this.findGoalsByAction(mainAction, actionTypeId);

  for (const goal of goals) {
    // 🆕 CHECK PREREQUISITE
    if (goal.prerequisiteBadgeId) {
      const hasPrerequisite = await this.prisma.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId,
            badgeId: goal.prerequisiteBadgeId
          }
        }
      });

      if (!hasPrerequisite) {
        logger.debug('Skipping goal - prerequisite badge not earned', {
          userId,
          goalId: goal.id,
          prerequisiteBadgeId: goal.prerequisiteBadgeId
        });
        continue; // Skip this goal
      }
    }

    // ... rest of logic
  }
}
```

**C) Admin UI:**
- Add prerequisite badge selector in Goal creation/edit modal
- Display prerequisite badge in goal list

---

## 🖥️ Admin Panel Capabilities

### ✅ Working Features

#### 1. Collection Management

**Routes:**
- `GET /admin/badges/collections` - List all collections
- `GET /admin/badges/collections/:id` - Get collection details
- `POST /admin/badges/collections` - Create new collection
- `PATCH /admin/badges/collections/:id` - Update collection
- `DELETE /admin/badges/collections/:id` - Delete collection

**UI Location:** `admin-panel/src/pages/gamification/BadgeCollections.tsx`, `CollectionDetail.tsx`

**Features:**
- ✅ Full CRUD operations
- ✅ Metadata editing (name, owner, descriptions, banner, category)
- ✅ Image upload support
- ✅ Category selection (with subcategories)
- ✅ Stats display (badge count, goal count)

**Form Fields:**
```typescript
// All editable via admin panel:
{
  name: string,
  categoryId: string | null,
  owner: string | null,
  focusSector: string | null,
  targetGroup: string | null,
  shortDescription: string | null,
  longDescription: string | null,
  bannerUrl: string | null,
  unlockCondition: string | null,
  completionBonus: string | null
}
```

#### 2. Badge Management

**Routes:**
- `GET /admin/badges` - List badges with filters
- `GET /admin/badges/:id` - Get badge details
- `POST /admin/badges` - Create badge
- `PATCH /admin/badges/:id` - Update badge
- `DELETE /admin/badges/:id` - Delete badge

**UI Location:** `admin-panel/src/pages/gamification/Badges.tsx`, `BadgeDetail.tsx`

**Features:**
- ✅ Full CRUD operations
- ✅ Filters (type, rarity, category, collection)
- ✅ Image upload
- ✅ Assign to collection
- ✅ View badge owners

#### 3. Collection-Badge Relationship

**Routes:**
- `GET /admin/badges/collections/:id/badges` - List badges in collection
- `POST /admin/badges/collections/:id/badges` - Add badge to collection
- `DELETE /admin/badges/collections/:id/badges/:badgeId` - Remove badge

**UI Location:** `CollectionDetail.tsx` (Badges tab)

**Features:**
- ✅ Add existing badges to collection
- ✅ Remove badges from collection
- ✅ Visual card display with images

#### 4. ActionType Listing

**Route:**
- `GET /admin/badges/action-types` - List all action types

**Features:**
- ✅ View all available action types
- ✅ See mainAction and code combinations
- ❌ Cannot create new action types

### ❌ Missing Features (Critical)

#### 1. Goal Management UI

**Backend API:** ✅ **FULLY IMPLEMENTED**

```typescript
// Existing endpoints:
POST   /admin/badges/collections/:id/goals
PATCH  /admin/badges/collections/:collectionId/goals/:goalId
DELETE /admin/badges/collections/:collectionId/goals/:goalId
```

**Admin Panel UI:** ❌ **COMPLETELY MISSING**

**What's Missing:**
- ❌ Goals Tab in CollectionDetail page
- ❌ Create Goal Modal
- ❌ Edit Goal Modal
- ❌ Goals List display
- ❌ Goal form with fields:
  - title
  - requirement
  - actionTypeId (dropdown)
  - rewardBadgeId (dropdown - must belong to collection)
  - pointsRequired (number)
  - difficulty (dropdown: EASY, MEDIUM, HARD)

**Impact:**
Without this UI, admins **cannot**:
- Define badge earning conditions
- Set progress requirements
- Link actions to badges
- Create functional collections

**Result:** Collections can be created but are **non-functional** without goals.

#### 2. ActionType Creation UI

**Backend:** ✅ Database supports it

**Admin Panel:** ❌ Only listing, no creation

**Impact:**
- SYSTEM actions like `AVATAR_UPLOAD`, `BIO_COMPLETE`, `FOLLOW_USER` must be added manually via SQL
- Non-technical admins cannot extend action types
- Requires developer intervention for new badge types

**Required UI:**
```typescript
// Create ActionType Modal
{
  mainAction: 'SYSTEM' | 'POST' | 'LIKE' | 'COMMENT' | 'BOOKMARK' | 'JOIN',
  code: string,
  label: string
}

// Validation:
// - Unique constraint: [mainAction, code]
// - Code should be UPPER_SNAKE_CASE
```

#### 3. Progress Monitoring Dashboard

**Backend:** ✅ Endpoints exist
- `GET /gamification/collections/:id` (includes user progress)
- `GET /gamification/users/:userId/achievements`

**Admin Panel:** ❌ No dedicated UI

**Missing Features:**
- ❌ Collection completion statistics
- ❌ Top users per collection
- ❌ Goal completion rates
- ❌ User progress search/filter
- ❌ Near-completion badges (users at 80%+)

**Use Case:**
- Admin wants to see how many users completed "ESSENTIALS" collection
- Admin wants to find users who are 1 action away from "Pathfinder" badge
- Admin wants to see which goals are hardest to complete

#### 4. User Badge Granting UI

**Backend:** ✅ GamificationService.grantBadgeToUser()

**Admin Panel:** ⚠️ Partial (in UserDetail page)

**Current:** Can manually grant badges to specific users
**Missing:** Bulk operations, undo, search

---

## 🚨 Critical Gaps & Missing Features

### Priority Matrix

| Feature | Backend | Admin UI | Impact | Priority |
|---------|---------|----------|--------|----------|
| Goal CRUD | ✅ Done | ❌ Missing | 🔴 CRITICAL | P0 |
| SYSTEM Action Tracking | ⚠️ Partial | N/A | 🟠 HIGH | P1 |
| ActionType Creation | ✅ Done | ❌ Missing | 🟡 MEDIUM | P2 |
| Prerequisite Badges | ❌ Missing | ❌ Missing | 🟡 MEDIUM | P2 |
| Reverse Tracking | ❌ Missing | N/A | 🔵 LOW | P3 |
| Progress Dashboard | ✅ Done | ❌ Missing | 🔵 LOW | P3 |

### Detailed Gap Analysis

#### P0: Goal Management UI (CRITICAL)

**Blocker:** Without this, the entire collection system is non-functional for admins.

**Requirements:**

1. **Goals Tab in CollectionDetail**
   ```tsx
   // Add to: admin-panel/src/pages/gamification/CollectionDetail.tsx
   const tabItems = [
     { key: 'summary', label: 'Summary', children: <SummaryTab /> },
     { key: 'badges', label: 'Badges', children: <BadgesTab /> },
     { key: 'goals', label: 'Goals', children: <GoalsTab /> }, // NEW
   ];
   ```

2. **CreateGoalModal Component**
   ```tsx
   // New file: admin-panel/src/pages/gamification/modals/CreateGoalModal.tsx
   interface CreateGoalModalProps {
     open: boolean;
     collectionId: string;
     onClose: () => void;
     onSuccess: () => void;
   }

   // Form fields:
   {
     title?: string,           // Optional - defaults to badge name
     requirement?: string,     // Optional - auto-generated
     actionTypeId: string,     // Required - dropdown from /action-types
     rewardBadgeId: string,    // Required - dropdown from collection badges
     pointsRequired: number,   // Required - positive integer
     difficulty: 'EASY' | 'MEDIUM' | 'HARD' // Required
   }
   ```

3. **GoalsTab Component**
   ```tsx
   // Features:
   // - List all goals for collection
   // - Display: title, action type, badge reward, points required, difficulty
   // - Actions: Edit, Delete
   // - Button: Create Goal
   ```

**API Integration:**
```typescript
// New file: admin-panel/src/api/admin-goals.ts
export async function fetchCollectionGoals(collectionId: string) {
  // GET /admin/badges/collections/:id/goals (NEW ENDPOINT NEEDED)
}

export async function createGoal(collectionId: string, data: CreateGoalInput) {
  // POST /admin/badges/collections/:id/goals (EXISTS)
}

export async function updateGoal(collectionId: string, goalId: string, data: UpdateGoalInput) {
  // PATCH /admin/badges/collections/:collectionId/goals/:goalId (EXISTS)
}

export async function deleteGoal(collectionId: string, goalId: string) {
  // DELETE /admin/badges/collections/:collectionId/goals/:goalId (EXISTS)
}
```

**Backend Addition Needed:**
```typescript
// Add to: backend/src/interfaces/admin/routers/admin-badges.router.ts
router.get(
  '/collections/:id/goals',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const goals = await prisma.achievementGoal.findMany({
      where: { collectionId: id },
      include: {
        actionType: { select: { mainAction: true, code: true, label: true } },
        rewardBadge: { select: { id: true, name: true, imageUrl: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    return res.json({ success: true, data: goals });
  })
);
```

**Estimated Effort:** 2-3 days
- Backend endpoint: 1 hour
- CreateGoalModal component: 6 hours
- EditGoalModal component: 4 hours
- GoalsTab component: 6 hours
- Testing & integration: 4 hours

#### P1: SYSTEM Action Tracking

**Affected Badges:**
- Bio-Hacker (AVATAR_UPLOAD, BIO_COMPLETE)
- Trust Agent (FOLLOW_USER)
- Scout (PRODUCT_TEST - if applicable)

**Required Changes:**

1. **Create Missing ActionTypes**
   ```sql
   INSERT INTO action_types (id, main_action, code, label, created_at, updated_at)
   VALUES
     (gen_random_uuid(), 'SYSTEM', 'AVATAR_UPLOAD', 'Upload Avatar', NOW(), NOW()),
     (gen_random_uuid(), 'SYSTEM', 'BIO_COMPLETE', 'Complete Bio', NOW(), NOW()),
     (gen_random_uuid(), 'SYSTEM', 'FOLLOW_USER', 'Follow User', NOW(), NOW());
   ```

2. **Update UserService**
   ```typescript
   // File: backend/src/application/user/user.service.ts

   // Add dependencies to constructor:
   private actionLogService: ActionLogService;
   private achievementProgressService: AchievementProgressService;

   constructor() {
     this.actionLogService = new ActionLogService();
     this.achievementProgressService = new AchievementProgressService();
   }

   // Update profile method:
   async updateUserProfile(userId: string, profileData: UpdateProfileData) {
     const updated = await this.profileRepo.update(userId, profileData);

     // Track avatar upload
     if (profileData.avatar) {
       await this.actionLogService.logAction({
         userId,
         mainAction: MainAction.SYSTEM,
         actionTypeCode: 'AVATAR_UPLOAD',
         entityType: 'profile',
         entityId: userId
       });
       await this.achievementProgressService.incrementProgressByCode(
         userId,
         MainAction.SYSTEM,
         'AVATAR_UPLOAD',
         1
       );
     }

     // Track bio completion
     if (profileData.bio && profileData.bio.length >= 50) {
       await this.actionLogService.logAction({
         userId,
         mainAction: MainAction.SYSTEM,
         actionTypeCode: 'BIO_COMPLETE',
         entityType: 'profile',
         entityId: userId
       });
       await this.achievementProgressService.incrementProgressByCode(
         userId,
         MainAction.SYSTEM,
         'BIO_COMPLETE',
         1
       );
     }

     return updated;
   }
   ```

3. **Add Follow Tracking**
   ```typescript
   // Find follow/trust service and add:
   async followUser(followerId: string, followedId: string) {
     // ... create follow relation

     await this.actionLogService.logAction({
       userId: followerId,
       mainAction: MainAction.SYSTEM,
       actionTypeCode: 'FOLLOW_USER',
       entityType: 'user',
       entityId: followedId
     });

     await this.achievementProgressService.incrementProgressByCode(
       followerId,
       MainAction.SYSTEM,
       'FOLLOW_USER',
       1
     );
   }
   ```

**Estimated Effort:** 1 day
- ActionType creation: 30 min
- UserService updates: 3 hours
- Follow service updates: 2 hours
- Testing: 2 hours

#### P2: Prerequisite Badge Support

**Database Migration:**
```prisma
// backend/prisma/schema.prisma
model AchievementGoal {
  // ... existing fields

  // NEW FIELD:
  prerequisiteBadgeId String? @map("prerequisite_badge_id") @db.Uuid

  // NEW RELATION:
  prerequisiteBadge Badge? @relation("GoalPrerequisiteBadge", fields: [prerequisiteBadgeId], references: [id], onDelete: SetNull)
}

model Badge {
  // ... existing relations

  // NEW RELATION:
  prerequisiteForGoals AchievementGoal[] @relation("GoalPrerequisiteBadge")
}
```

**Migration File:**
```typescript
// backend/prisma/migrations/[timestamp]_add_prerequisite_badge_to_goals/migration.sql
ALTER TABLE achievement_goals
ADD COLUMN prerequisite_badge_id UUID REFERENCES badges(id) ON DELETE SET NULL;

CREATE INDEX idx_achievement_goals_prerequisite_badge
ON achievement_goals(prerequisite_badge_id);
```

**Service Logic:**
```typescript
// backend/src/application/gamification/achievement-progress.service.ts
private async findGoalsByAction(
  mainAction: MainAction,
  actionTypeId: string
): Promise<GoalWithPrerequisiteCheck[]> {
  const goals = await this.prisma.achievementGoal.findMany({
    where: { mainAction, actionTypeId },
    include: {
      rewardBadge: { select: { type: true } },
      prerequisiteBadge: { select: { id: true, name: true } }
    }
  });

  return goals
    .filter(g => g.rewardBadge?.type === 'COLLECTION')
    .map(g => ({
      id: g.id,
      pointsRequired: g.pointsRequired,
      rewardBadgeId: g.rewardBadgeId,
      prerequisiteBadgeId: g.prerequisiteBadgeId
    }));
}

async incrementProgress(userId, mainAction, actionTypeId, amount) {
  const goals = await this.findGoalsByAction(mainAction, actionTypeId);

  for (const goal of goals) {
    // Check prerequisite
    if (goal.prerequisiteBadgeId) {
      const hasPrerequisite = await this.prisma.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId,
            badgeId: goal.prerequisiteBadgeId
          }
        }
      });

      if (!hasPrerequisite) {
        logger.debug('Skipping goal - prerequisite not met', {
          userId,
          goalId: goal.id,
          prerequisiteBadgeId: goal.prerequisiteBadgeId
        });
        continue;
      }
    }

    // ... rest of increment logic
  }
}
```

**Admin UI:**
```tsx
// admin-panel/src/pages/gamification/modals/CreateGoalModal.tsx
<Form.Item
  label="Prerequisite Badge (Optional)"
  name="prerequisiteBadgeId"
  tooltip="User must own this badge before this goal can progress"
>
  <Select
    allowClear
    placeholder="Select prerequisite badge (optional)"
    options={collectionBadges.map(b => ({
      label: b.name,
      value: b.id
    }))}
  />
</Form.Item>
```

**Estimated Effort:** 2 days
- Migration: 1 hour
- Service logic: 4 hours
- Admin UI: 3 hours
- Testing: 8 hours

#### P3: Reverse Tracking

**Use Cases:**
- Opinion Leader: "Get bookmarked by others"
- Influencer badges: "Get liked by others"
- Helpful badges: "Get upvoted by others"

**Implementation:**

1. **Create Reverse ActionTypes**
   ```sql
   INSERT INTO action_types (id, main_action, code, label, created_at, updated_at)
   VALUES
     (gen_random_uuid(), 'BOOKMARK', 'RECEIVED', 'Post Bookmarked by Others', NOW(), NOW()),
     (gen_random_uuid(), 'LIKE', 'RECEIVED', 'Post Liked by Others', NOW(), NOW());
   ```

2. **Update Interaction Service**
   ```typescript
   // backend/src/application/interaction/interaction.service.ts

   async favoritePost(userId: string, postId: string) {
     const post = await this.contentPostRepo.findById(postId);
     // ... create favorite

     // Track for user who bookmarked (existing)
     await this.actionLogService.logAction({
       userId,
       mainAction: MainAction.BOOKMARK,
       actionTypeCode: 'ALL',
       entityType: 'post',
       entityId: postId
     });
     await this.achievementProgressService.incrementProgressByCode(
       userId,
       MainAction.BOOKMARK,
       'ALL',
       1
     );

     // NEW: Track for post owner (reverse)
     if (post.userId !== userId) { // Don't track self-bookmarks
       await this.actionLogService.logAction({
         userId: post.userId,
         mainAction: MainAction.BOOKMARK,
         actionTypeCode: 'RECEIVED',
         entityType: 'post',
         entityId: postId,
         metadata: { bookmarkedBy: userId }
       });
       await this.achievementProgressService.incrementProgressByCode(
         post.userId,
         MainAction.BOOKMARK,
         'RECEIVED',
         1
       );
     }
   }

   // Similar for likePost(), etc.
   ```

**Estimated Effort:** 1-2 days
- ActionType creation: 30 min
- Service updates (bookmark, like): 4 hours
- Testing: 3 hours

---

## 🗺️ Implementation Roadmap

### Phase 1: Core Functionality (Week 1)

**Goal:** Make ESSENTIALS collection fully functional

#### Sprint 1.1: Goal Management UI (3 days)
- [ ] Day 1: Backend endpoint for listing goals
- [ ] Day 2: CreateGoalModal component
- [ ] Day 3: GoalsTab component + EditGoalModal

**Deliverable:** Admins can create and manage goals via UI

#### Sprint 1.2: SYSTEM Action Tracking (2 days)
- [ ] Day 1: Create ActionTypes + UserService tracking
- [ ] Day 2: Follow service tracking + testing

**Deliverable:** Bio-Hacker and Trust Agent badges functional

### Phase 2: Enhanced Features (Week 2)

#### Sprint 2.1: Prerequisite Support (2 days)
- [ ] Day 1: Database migration + service logic
- [ ] Day 2: Admin UI + testing

**Deliverable:** Spec Analyst and Trust Agent prerequisites work

#### Sprint 2.2: Reverse Tracking (2 days)
- [ ] Day 1: ActionTypes + InteractionService updates
- [ ] Day 2: Testing + edge cases

**Deliverable:** Opinion Leader badge functional

#### Sprint 2.3: ActionType Management UI (1 day)
- [ ] CreateActionTypeModal component
- [ ] Integration with goal creation

**Deliverable:** Admins can create custom action types

### Phase 3: Polish & Monitoring (Week 3)

#### Sprint 3.1: Progress Dashboard (3 days)
- [ ] Collection statistics page
- [ ] User progress search/filter
- [ ] Near-completion notifications

**Deliverable:** Admins can monitor collection adoption

#### Sprint 3.2: Documentation & Training (2 days)
- [ ] Admin user guide
- [ ] Video tutorials
- [ ] Best practices document

**Deliverable:** Non-technical admins can independently manage collections

---

## 💡 Technical Recommendations

### Architecture Decisions

#### 1. Keep Fire-and-Forget Pattern

**Current:** Activity tracking uses `.catch()` instead of `await`

```typescript
// GOOD (current):
this.achievementProgressService
  .incrementProgressByCode(userId, MainAction.LIKE, 'ALL', 1)
  .catch(err => logger.warn('Failed to track', { err }));

// BAD (blocking):
await this.achievementProgressService.incrementProgressByCode(...);
```

**Rationale:**
- Badge tracking shouldn't block user actions
- System remains performant even if gamification fails
- Errors are logged but don't affect UX

**Recommendation:** ✅ Keep as-is

#### 2. Idempotency for Badge Granting

**Current:** `grantBadgeToUser()` checks for existing UserBadge

```typescript
const existingBadge = await this.prisma.userBadge.findUnique({
  where: { userId_badgeId: { userId, badgeId } }
});

if (existingBadge) {
  logger.info('Badge already granted');
  return existingBadge; // No duplicate creation
}
```

**Recommendation:** ✅ Keep this safeguard

**Additional:** Consider adding unique constraint at database level:
```prisma
model UserBadge {
  @@unique([userId, badgeId]) // Already exists!
}
```

#### 3. Compound Actions - Use AchievementChain

**Problem:** Bio-Hacker requires "Avatar AND Bio" (two actions)

**Option A:** Create prerequisite chain
```
Goal 1: Upload Avatar → Badge A
Goal 2: Complete Bio → Badge B (prerequisite: Badge A)
Goal 3: (Both complete) → Bio-Hacker Badge
```

**Option B:** Use AchievementChain
```typescript
const chain = await prisma.achievementChain.create({
  data: {
    name: 'Bio-Hacker Chain',
    category: 'ESSENTIALS',
    goals: {
      create: [
        {
          collectionId,
          title: 'Upload Avatar',
          mainAction: MainAction.SYSTEM,
          actionTypeId: avatarActionTypeId,
          pointsRequired: 1
        },
        {
          collectionId,
          title: 'Complete Bio',
          mainAction: MainAction.SYSTEM,
          actionTypeId: bioActionTypeId,
          pointsRequired: 1
        }
      ]
    }
  }
});
```

**Recommendation:** Use **Option B (AchievementChain)** for compound requirements

**Reason:**
- Clearer intent
- Existing system support
- No intermediate badges needed

#### 4. Progress Calculation - Use Transactions

**Current:** Progress updates are transactional (good!)

```typescript
await this.prisma.$transaction(async (tx) => {
  const existing = await tx.userAchievement.findUnique(...);
  const next = (existing?.progress ?? 0) + amount;

  await tx.userAchievement.upsert({
    where: { userId_goalId: { userId, goalId } },
    update: { progress: next, completed: next >= goal.pointsRequired },
    create: { userId, goalId, progress: next, completed: next >= goal.pointsRequired }
  });
});
```

**Recommendation:** ✅ Keep using transactions for consistency

**Enhancement:** Consider optimistic locking for high-concurrency scenarios:
```typescript
// Add version field to UserAchievement
progress: number;
version: number; // Increment on each update

// Update with version check
await tx.userAchievement.updateMany({
  where: { id, version: currentVersion },
  data: { progress: next, version: currentVersion + 1 }
});
```

### Performance Considerations

#### 1. Index Optimization

**Current Indexes (Good):**
```sql
CREATE INDEX idx_achievement_goals_main_action_type
ON achievement_goals(main_action, action_type_id);

CREATE INDEX idx_user_achievements_user_goal
ON user_achievements(user_id, goal_id);
```

**Recommended Additional Indexes:**
```sql
-- For reverse tracking lookups
CREATE INDEX idx_action_logs_entity
ON action_logs(entity_type, entity_id);

-- For goal completion queries
CREATE INDEX idx_user_achievements_completed
ON user_achievements(completed, user_id);

-- For prerequisite checking
CREATE INDEX idx_user_badges_user_badge
ON user_badges(user_id, badge_id)
WHERE claimed = true;
```

#### 2. Caching Strategy

**Current:** No caching for gamification data

**Recommendation:** Add Redis caching for:
```typescript
// Cache user badge counts (1 hour TTL)
cache.set(`user:${userId}:badge_count`, count, 3600);

// Cache collection completion status (10 min TTL)
cache.set(`user:${userId}:collection:${collectionId}:progress`, progress, 600);

// Invalidate on badge grant:
await cache.invalidate(`user:${userId}:badge_count`);
await cache.invalidate(`user:${userId}:collection:*`);
```

**Impact:**
- Faster profile page loads
- Reduced database queries
- Better scalability

#### 3. Batch Processing for Backfills

**Use Case:** Retroactively grant badges for existing user actions

**Current:** `ActionLogService.backfillActionsFromExistingData()` (good start)

**Enhancement:**
```typescript
// Process in batches to avoid memory issues
async backfillUserBadges(userId?: string, batchSize = 100) {
  const users = userId
    ? [{ id: userId }]
    : await this.prisma.user.findMany({ select: { id: true } });

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);

    await Promise.all(
      batch.map(user => this.backfillSingleUser(user.id))
    );

    logger.info(`Backfilled batch ${i / batchSize + 1}`, {
      completed: Math.min(i + batchSize, users.length),
      total: users.length
    });
  }
}
```

### Security Considerations

#### 1. Badge Manipulation Prevention

**Risk:** Users could potentially trigger actions repeatedly to farm badges

**Current Protection:** None explicit

**Recommendation:**
```typescript
// Add cooldown for certain actions
const COOLDOWN_PERIODS = {
  AVATAR_UPLOAD: 24 * 60 * 60 * 1000, // 24 hours
  BIO_COMPLETE: 24 * 60 * 60 * 1000,
  FOLLOW_USER: 60 * 1000 // 1 minute per follow
};

async logAction(params) {
  // Check last action timestamp
  const lastAction = await this.prisma.actionLog.findFirst({
    where: {
      userId: params.userId,
      mainAction: params.mainAction,
      actionTypeCode: params.actionTypeCode
    },
    orderBy: { createdAt: 'desc' }
  });

  if (lastAction) {
    const cooldown = COOLDOWN_PERIODS[params.actionTypeCode];
    const timeSince = Date.now() - lastAction.createdAt.getTime();

    if (cooldown && timeSince < cooldown) {
      logger.warn('Action cooldown not elapsed', {
        userId: params.userId,
        action: params.actionTypeCode,
        remainingMs: cooldown - timeSince
      });
      return; // Skip logging
    }
  }

  // ... log action
}
```

#### 2. Admin Permission Checks

**Current:** `authMiddleware + requireAdmin` on all routes (good!)

**Enhancement:**
```typescript
// Add granular permissions
enum AdminPermission {
  MANAGE_BADGES = 'manage_badges',
  MANAGE_COLLECTIONS = 'manage_collections',
  GRANT_BADGES = 'grant_badges',
  VIEW_ANALYTICS = 'view_analytics'
}

// Check specific permission
router.post('/badges',
  authMiddleware,
  requirePermission(AdminPermission.MANAGE_BADGES),
  asyncHandler(...)
);
```

---

## 📚 Appendix

### A. SQL Queries for Manual Setup

#### Create ESSENTIALS Collection

```sql
-- 1. Create collection
INSERT INTO badge_collections (
  id, name, owner, focus_sector, short_description, long_description,
  unlock_condition, completion_bonus, created_at, updated_at
)
VALUES (
  gen_random_uuid(),
  'ESSENTIALS',
  'Aycan K.',
  NULL,
  'In this world, you don''t just consume content; you create, compare, and guide.',
  'This collection is designed to transform you from a silent user into a recognized actor.',
  NULL,
  NULL,
  NOW(),
  NOW()
)
RETURNING id; -- Save this as COLLECTION_ID
```

#### Create ActionTypes

```sql
-- Missing SYSTEM action types
INSERT INTO action_types (id, main_action, code, label, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'SYSTEM', 'AVATAR_UPLOAD', 'Upload Avatar', NOW(), NOW()),
  (gen_random_uuid(), 'SYSTEM', 'BIO_COMPLETE', 'Complete Bio', NOW(), NOW()),
  (gen_random_uuid(), 'SYSTEM', 'FOLLOW_USER', 'Follow User', NOW(), NOW()),
  (gen_random_uuid(), 'POST', 'BENCHMARK', 'Benchmark Post', NOW(), NOW()),
  (gen_random_uuid(), 'POST', 'UPDATE', 'Update Post', NOW(), NOW()),
  (gen_random_uuid(), 'BOOKMARK', 'RECEIVED', 'Post Bookmarked by Others', NOW(), NOW())
ON CONFLICT (main_action, code) DO NOTHING;
```

#### Create Badges

```sql
-- Get badge category ID first
SELECT id FROM badge_categories WHERE name = 'Collection' LIMIT 1; -- Save as CATEGORY_ID

-- Create badges (example: Bio-Hacker)
INSERT INTO badges (
  id, name, description, image_url, type, rarity,
  category_id, collection_id, created_at
)
VALUES (
  gen_random_uuid(),
  'Bio-Hacker',
  'I''ve hacked the system. My identity is live.',
  NULL, -- Add image URL later
  'COLLECTION',
  'COMMON',
  'CATEGORY_ID',
  'COLLECTION_ID',
  NOW()
)
RETURNING id; -- Save as BADGE_ID
```

#### Create Goals

```sql
-- Get action type IDs
SELECT id, code FROM action_types WHERE main_action = 'SYSTEM';

-- Create goal for Bio-Hacker (compound - needs 2 goals)
INSERT INTO achievement_goals (
  id, collection_id, title, requirement,
  main_action, action_type_id, reward_badge_id,
  points_required, difficulty
)
VALUES
  -- Goal 1: Avatar
  (
    gen_random_uuid(),
    'COLLECTION_ID',
    'Upload Avatar',
    'Upload a profile avatar',
    'SYSTEM',
    (SELECT id FROM action_types WHERE main_action = 'SYSTEM' AND code = 'AVATAR_UPLOAD'),
    'BIO_HACKER_BADGE_ID',
    1,
    'EASY'
  ),
  -- Goal 2: Bio (shares same badge)
  (
    gen_random_uuid(),
    'COLLECTION_ID',
    'Complete Bio',
    'Complete your bio',
    'SYSTEM',
    (SELECT id FROM action_types WHERE main_action = 'SYSTEM' AND code = 'BIO_COMPLETE'),
    'BIO_HACKER_BADGE_ID',
    1,
    'EASY'
  );
```

### B. API Endpoint Reference

#### Collection Endpoints

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/admin/badges/collections` | List collections | ✅ |
| GET | `/admin/badges/collections/:id` | Get collection | ✅ |
| POST | `/admin/badges/collections` | Create collection | ✅ |
| PATCH | `/admin/badges/collections/:id` | Update collection | ✅ |
| DELETE | `/admin/badges/collections/:id` | Delete collection | ✅ |
| GET | `/admin/badges/collections/stats` | Collection stats | ✅ |
| GET | `/admin/badges/collections/categories` | Category tree | ✅ |

#### Badge Endpoints

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/admin/badges` | List badges | ✅ |
| GET | `/admin/badges/:id` | Get badge | ✅ |
| POST | `/admin/badges` | Create badge | ✅ |
| PATCH | `/admin/badges/:id` | Update badge | ✅ |
| DELETE | `/admin/badges/:id` | Delete badge | ✅ |
| GET | `/admin/badges/stats` | Badge stats | ✅ |
| GET | `/admin/badges/:id/owners` | Badge owners | ✅ |

#### Goal Endpoints

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/admin/badges/collections/:id/goals` | List goals | ❌ Missing |
| POST | `/admin/badges/collections/:id/goals` | Create goal | ✅ |
| PATCH | `/admin/badges/collections/:collectionId/goals/:goalId` | Update goal | ✅ |
| DELETE | `/admin/badges/collections/:collectionId/goals/:goalId` | Delete goal | ✅ |

#### Collection-Badge Relationship

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/admin/badges/collections/:id/badges` | List badges | ✅ |
| POST | `/admin/badges/collections/:id/badges` | Add badge | ✅ |
| DELETE | `/admin/badges/collections/:id/badges/:badgeId` | Remove badge | ✅ |

#### ActionType Endpoints

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/admin/badges/action-types` | List types | ✅ |
| POST | `/admin/badges/action-types` | Create type | ❌ Missing |

### C. Testing Checklist

#### Goal Management UI Testing

- [ ] Create goal with valid data succeeds
- [ ] Create goal without required fields shows validation errors
- [ ] ActionType dropdown shows all available types
- [ ] RewardBadge dropdown only shows badges in current collection
- [ ] Difficulty dropdown has EASY, MEDIUM, HARD options
- [ ] Title defaults to badge name when empty
- [ ] Requirement auto-generates when empty
- [ ] Edit goal updates successfully
- [ ] Delete goal prompts confirmation
- [ ] Delete goal removes from list
- [ ] Goals list displays all fields correctly
- [ ] Goals list shows action type label, not ID
- [ ] Goals list shows badge name, not ID

#### SYSTEM Action Tracking Testing

- [ ] Avatar upload increments AVATAR_UPLOAD progress
- [ ] Avatar upload logs action to ActionLog table
- [ ] Bio completion (>50 chars) increments BIO_COMPLETE progress
- [ ] Completing both avatar + bio grants Bio-Hacker badge
- [ ] Following user increments FOLLOW_USER progress
- [ ] Following user logs action to ActionLog table
- [ ] Re-uploading avatar doesn't increment progress again (cooldown)
- [ ] Updating bio from 30 to 60 chars increments (threshold check)

#### Prerequisite Badge Testing

- [ ] Goal with prerequisite doesn't progress until prerequisite earned
- [ ] After earning prerequisite, goal progress resumes
- [ ] Spec Analyst requires Vault Keeper (5 inventory items)
- [ ] Trust Agent requires Bio-Hacker (avatar + bio)
- [ ] Admin UI shows prerequisite badge in goal form
- [ ] Admin UI allows clearing prerequisite (set to null)

#### Reverse Tracking Testing

- [ ] User A bookmarks User B's post
- [ ] User B's BOOKMARK_RECEIVED progress increments
- [ ] User A's BOOKMARK_ALL progress increments
- [ ] Self-bookmarking doesn't trigger RECEIVED tracking
- [ ] Opinion Leader badge granted after 3 RECEIVED bookmarks
- [ ] Same logic works for LIKE_RECEIVED (if implemented)

### D. Troubleshooting Guide

#### Issue: Goals not appearing in admin panel

**Symptoms:**
- Goals tab is visible
- "No goals" message shown
- Backend logs show goals exist

**Diagnosis:**
```bash
# Check if goals exist in database
docker-compose exec backend npx prisma studio
# Navigate to AchievementGoal table
# Filter by collectionId
```

**Solution:**
- Check API endpoint returns data: `GET /admin/badges/collections/:id/goals`
- Check network tab for errors
- Verify admin authentication token
- Check CORS settings

#### Issue: Badge not granted when progress completes

**Symptoms:**
- UserAchievement shows `completed: true`
- No UserBadge record created
- No notification sent

**Diagnosis:**
```typescript
// Check logs for errors
docker-compose logs -f backend | grep "Failed to grant badge"

// Check database state
SELECT * FROM user_achievements WHERE user_id = 'USER_ID' AND completed = true;
SELECT * FROM user_badges WHERE user_id = 'USER_ID';
```

**Possible Causes:**
1. `rewardBadgeId` is null in AchievementGoal
2. Badge was deleted but goal still references it
3. GamificationService threw error (check logs)
4. Transaction rolled back due to constraint violation

**Solution:**
```sql
-- Check goal has valid badge
SELECT g.id, g.reward_badge_id, b.name
FROM achievement_goals g
LEFT JOIN badges b ON b.id = g.reward_badge_id
WHERE g.id = 'GOAL_ID';

-- Manually grant badge if needed
INSERT INTO user_badges (id, user_id, badge_id, is_visible, visibility, claimed, created_at)
VALUES (gen_random_uuid(), 'USER_ID', 'BADGE_ID', true, 'PUBLIC', false, NOW());
```

#### Issue: Progress not incrementing

**Symptoms:**
- User performs action
- ActionLog entry created
- UserAchievement.progress not updated

**Diagnosis:**
```typescript
// Check if action type matches goal
SELECT g.*, at.code
FROM achievement_goals g
JOIN action_types at ON at.id = g.action_type_id
WHERE g.collection_id = 'COLLECTION_ID';

// Check recent action logs
SELECT * FROM action_logs
WHERE user_id = 'USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

**Possible Causes:**
1. ActionType code mismatch (e.g., goal expects "TIP", logging "ALL")
2. MainAction mismatch (goal expects POST, logging SYSTEM)
3. Service not calling `incrementProgressByCode()`
4. Fire-and-forget failed silently (check logs)
5. Prerequisite badge not earned

**Solution:**
```typescript
// Verify action type alignment
const goalActionType = await prisma.actionType.findUnique({
  where: { id: goal.actionTypeId }
});

const loggedActionType = await prisma.actionType.findUnique({
  where: {
    mainAction_code: {
      mainAction: 'POST',
      code: 'TIP'
    }
  }
});

// They must match!
```

---

## 📝 Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-12 | System Analysis | Initial comprehensive analysis |

---

**End of Document**
