# User API Specification

## Overview

This document defines all user-facing gamification API endpoints. These endpoints allow users to view badges, track achievement progress, claim rewards, and manage badge visibility.

## Base URL

All endpoints are prefixed with `/api`

## Authentication

- **Optional Auth**: Endpoints marked with 🌐 work without authentication but return more data when authenticated
- **Required Auth**: Endpoints marked with 🔒 require valid JWT token via `authMiddleware`

---

## Badge Endpoints

### 🌐 GET /api/badges

List all available badges with pagination and filters.

**Authentication**: Optional (more data if authenticated)

**Query Parameters**:
```typescript
{
  type?: 'COLLECTION' | 'EVENT' | 'COSMETIC' | 'BRAND';
  rarity?: 'COMMON' | 'RARE' | 'EPIC';
  categoryId?: string; // UUID
  search?: string; // Search name/description
  limit?: number; // Default: 20, Max: 100
  offset?: number; // Default: 0
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    badges: Array<{
      id: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      type: BadgeType;
      rarity: BadgeRarity;
      pointValue: number; // Calculated from rarity + type
      category: {
        id: string;
        name: string;
      };
      earnedByUserCount: number; // How many users have this badge
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
GET /api/badges?rarity=RARE&limit=10&offset=0
```

---

### 🌐 GET /api/badges/:id

Get detailed information about a specific badge.

**Authentication**: Optional

**Path Parameters**:
- `id` (string, UUID) - Badge ID

**Response**:
```typescript
{
  success: true,
  data: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    type: BadgeType;
    rarity: BadgeRarity;
    pointValue: number;
    boostMultiplier: number | null;
    rewardMultiplier: number | null;
    category: {
      id: string;
      name: string;
    };
    collection: {
      id: string;
      name: string;
    } | null;
    earnedByUserCount: number;
    recentEarners: Array<{
      userId: string;
      username: string;
      claimedAt: Date | null;
    }>; // Last 10 users who earned this badge
  }
}
```

**Errors**:
- `404 Not Found` - Badge does not exist

**Example**:
```http
GET /api/badges/550e8400-e29b-41d4-a716-446655440000
```

---

## Collection Endpoints

### 🌐 GET /api/collections

List all badge collections with optional user progress.

**Authentication**: Optional (progress included if authenticated)

**Query Parameters**:
```typescript
{
  categoryId?: string; // UUID
  search?: string; // Search name/description
  includeProgress?: boolean; // Default: false (auto-true if authenticated)
  limit?: number; // Default: 20, Max: 100
  offset?: number; // Default: 0
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    collections: Array<{
      id: string;
      name: string;
      bannerUrl: string | null;
      shortDescription: string | null;
      focusSector: string | null;
      targetGroup: string | null;
      badgeCount: number;
      goalCount: number;
      isLocked: boolean; // Based on unlockCondition
      userProgress?: { // Only if authenticated
        completedGoals: number;
        totalGoals: number;
        percentage: number;
        isCompleted: boolean;
      };
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
GET /api/collections?search=Content&limit=10
```

---

### 🌐 GET /api/collections/:id

Get detailed collection information with goals and user progress.

**Authentication**: Optional (progress included if authenticated)

**Path Parameters**:
- `id` (string, UUID) - Collection ID

**Response**:
```typescript
{
  success: true,
  data: {
    id: string;
    name: string;
    bannerUrl: string | null;
    owner: string | null;
    focusSector: string | null;
    targetGroup: string | null;
    shortDescription: string | null;
    longDescription: string | null;
    unlockCondition: string | null; // JSON string
    completionBonus: string | null;
    category: {
      id: string;
      name: string;
    } | null;
    badges: Array<{
      id: string;
      name: string;
      imageUrl: string | null;
      rarity: BadgeRarity;
    }>;
    goals: Array<{
      id: string;
      title: string | null;
      requirement: string | null;
      actionType: {
        mainAction: string;
        label: string;
      };
      pointsRequired: number;
      difficulty: AchievementDifficulty;
      rewardBadge: {
        id: string;
        name: string;
      } | null;
      userProgress?: { // Only if authenticated
        current: number;
        percentage: number;
        completed: boolean;
        completedAt: Date | null;
      };
    }>;
    isLocked: boolean;
    userCompletion?: { // Only if authenticated
      completedGoals: number;
      totalGoals: number;
      percentage: number;
      isCompleted: boolean;
    };
  }
}
```

**Errors**:
- `404 Not Found` - Collection does not exist

**Example**:
```http
GET /api/collections/550e8400-e29b-41d4-a716-446655440000
```

---

## User Profile Badge Endpoints

### 🔒 GET /api/profile/badges

Get authenticated user's badges (claimed and unclaimed).

**Authentication**: Required

**Query Parameters**:
```typescript
{
  claimed?: boolean; // Filter by claim status
  visibility?: 'PUBLIC' | 'FRIENDS' | 'TRUSTERS' | 'PRIVATE';
  type?: 'COLLECTION' | 'EVENT' | 'COSMETIC' | 'BRAND';
  limit?: number; // Default: 50, Max: 100
  offset?: number; // Default: 0
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    badges: Array<{
      id: string; // UserBadge ID
      badgeId: string; // Badge ID
      badge: {
        id: string;
        name: string;
        description: string | null;
        imageUrl: string | null;
        type: BadgeType;
        rarity: BadgeRarity;
        pointValue: number;
      };
      claimed: boolean;
      claimedAt: Date | null;
      isVisible: boolean;
      displayOrder: number | null; // 1-6 for showcase
      visibility: BadgeVisibility;
      earnedAt: Date; // createdAt of UserBadge
    }>;
    summary: {
      totalBadges: number;
      claimedCount: number;
      unclaimedCount: number;
      totalPoints: number; // Sum of claimed badge points
    };
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
GET /api/profile/badges?claimed=false&limit=10
```

---

### 🔒 POST /api/profile/badges/:badgeId/claim

Claim an unclaimed badge.

**Authentication**: Required

**Path Parameters**:
- `badgeId` (string, UUID) - Badge ID (not UserBadge ID)

**Request Body**: None

**Response**:
```typescript
{
  success: true,
  message: "Badge claimed successfully",
  data: {
    userBadgeId: string;
    claimedAt: Date;
  }
}
```

**Errors**:
- `404 Not Found` - Badge not found in user's collection
- `400 Bad Request` - Badge already claimed

**Example**:
```http
POST /api/profile/badges/550e8400-e29b-41d4-a716-446655440000/claim
```

---

### 🔒 PUT /api/profile/badges/:userBadgeId/visibility

Update badge visibility settings.

**Authentication**: Required

**Path Parameters**:
- `userBadgeId` (string, UUID) - UserBadge ID (not Badge ID)

**Request Body**:
```typescript
{
  visibility: 'PUBLIC' | 'FRIENDS' | 'TRUSTERS' | 'PRIVATE';
  isVisible?: boolean; // Optional, defaults to true if visibility != PRIVATE
}
```

**Response**:
```typescript
{
  success: true,
  message: "Badge visibility updated"
}
```

**Errors**:
- `404 Not Found` - UserBadge not found or doesn't belong to user

**Example**:
```http
PUT /api/profile/badges/660e8400-e29b-41d4-a716-446655440000/visibility

{
  "visibility": "FRIENDS",
  "isVisible": true
}
```

---

### 🔒 PUT /api/profile/badges/display-order

Update display order for profile showcase (max 6 badges).

**Authentication**: Required

**Request Body**:
```typescript
{
  badgeOrders: Array<{
    userBadgeId: string; // UUID
    displayOrder: number; // 1-6
  }>;
}
```

**Response**:
```typescript
{
  success: true,
  message: "Display order updated"
}
```

**Errors**:
- `400 Bad Request` - Invalid display order (must be 1-6)
- `400 Bad Request` - UserBadge doesn't belong to user

**Example**:
```http
PUT /api/profile/badges/display-order

{
  "badgeOrders": [
    { "userBadgeId": "uuid-1", "displayOrder": 1 },
    { "userBadgeId": "uuid-2", "displayOrder": 2 },
    { "userBadgeId": "uuid-3", "displayOrder": 3 }
  ]
}
```

---

## Achievement Progress Endpoints

### 🔒 GET /api/profile/achievements

Get authenticated user's achievement progress.

**Authentication**: Required

**Query Parameters**:
```typescript
{
  completed?: boolean; // Filter by completion status
  collectionId?: string; // UUID - Filter by collection
  limit?: number; // Default: 50, Max: 100
  offset?: number; // Default: 0
}
```

**Response**:
```typescript
{
  success: true,
  data: {
    achievements: Array<{
      id: string; // UserAchievement ID
      goalId: string;
      goal: {
        id: string;
        title: string | null;
        requirement: string | null;
        actionType: {
          mainAction: string;
          label: string;
        };
        pointsRequired: number;
        difficulty: AchievementDifficulty;
        collection: {
          id: string;
          name: string;
        };
        rewardBadge: {
          id: string;
          name: string;
        } | null;
      };
      progress: number; // Current count
      percentage: number; // (progress / pointsRequired) * 100
      completed: boolean;
      completedAt: Date | null;
      remaining: number; // pointsRequired - progress
    }>;
    summary: {
      totalAchievements: number;
      completedCount: number;
      inProgressCount: number;
    };
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
GET /api/profile/achievements?completed=false&limit=20
```

---

### 🔒 GET /api/profile/gamification-stats

Get comprehensive gamification statistics for authenticated user.

**Authentication**: Required

**Response**:
```typescript
{
  success: true,
  data: {
    badges: {
      total: number;
      claimed: number;
      unclaimed: number;
      byRarity: {
        COMMON: number;
        RARE: number;
        EPIC: number;
      };
      byType: {
        COLLECTION: number;
        EVENT: number;
        COSMETIC: number;
        BRAND: number;
      };
    };
    achievements: {
      total: number;
      completed: number;
      inProgress: number;
      notStarted: number;
    };
    level: number; // Calculated from total badge points (100 points per level)
    experience: number; // Total points earned
    nextLevelExperience: number; // Points needed for next level
    collections: {
      total: number;
      completed: number;
      inProgress: number;
    };
  }
}
```

**Example**:
```http
GET /api/profile/gamification-stats
```

---

### 🔒 GET /api/profile/near-completion

Get achievement goals near completion (80%+ progress).

**Authentication**: Required

**Response**:
```typescript
{
  success: true,
  data: {
    goals: Array<{
      goalId: string;
      title: string;
      progress: number;
      pointsRequired: number;
      percentage: number;
      remaining: number;
      estimatedActionsNeeded: number; // Same as remaining (1:1 mapping)
      rewardBadge: {
        id: string;
        name: string;
      } | null;
      collection: {
        id: string;
        name: string;
      };
    }>;
  }
}
```

**Example**:
```http
GET /api/profile/near-completion
```

---

## Validation Schemas (Zod)

### BadgesQuerySchema

```typescript
const BadgesQuerySchema = z.object({
  type: z.enum(['COLLECTION', 'EVENT', 'COSMETIC', 'BRAND']).optional(),
  rarity: z.enum(['COMMON', 'RARE', 'EPIC']).optional(),
  categoryId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
```

### CollectionsQuerySchema

```typescript
const CollectionsQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  search: z.string().optional(),
  includeProgress: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
```

### UpdateBadgeVisibilitySchema

```typescript
const UpdateBadgeVisibilitySchema = z.object({
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'TRUSTERS', 'PRIVATE']),
  isVisible: z.boolean().optional(),
});
```

### UpdateBadgeDisplayOrderSchema

```typescript
const UpdateBadgeDisplayOrderSchema = z.object({
  badgeOrders: z.array(
    z.object({
      userBadgeId: z.string().uuid(),
      displayOrder: z.number().int().min(1).max(6),
    })
  ).min(1).max(6),
});
```

### UserBadgesQuerySchema

```typescript
const UserBadgesQuerySchema = z.object({
  claimed: z.coerce.boolean().optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'TRUSTERS', 'PRIVATE']).optional(),
  type: z.enum(['COLLECTION', 'EVENT', 'COSMETIC', 'BRAND']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
```

### UserAchievementsQuerySchema

```typescript
const UserAchievementsQuerySchema = z.object({
  completed: z.coerce.boolean().optional(),
  collectionId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
```

---

## Error Responses

All endpoints follow consistent error format:

```typescript
{
  success: false,
  message: string; // Human-readable error message
  error?: {
    code: string; // Machine-readable error code
    details?: unknown; // Additional error details (dev mode only)
  };
}
```

### Common Status Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing or invalid auth token
- `404 Not Found` - Resource not found
- `409 Conflict` - Duplicate resource (e.g., badge already claimed)
- `500 Internal Server Error` - Server error

---

**Document Version**: 1.0
**Last Updated**: 2026-02-11
**Related Specs**: 01_BADGE_SYSTEM_SPEC.md, 02_COLLECTION_SYSTEM_SPEC.md
