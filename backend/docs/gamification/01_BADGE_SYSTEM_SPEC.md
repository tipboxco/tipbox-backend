# Badge System Specification

## Overview

The badge system is the core reward mechanism in Tipbox's gamification framework. Badges represent achievements, event participation, cosmetic customization, and brand partnerships. This document defines badge types, properties, lifecycle, and visibility rules.

## Badge Types (BadgeType Enum)

### COLLECTION
- **Purpose**: Earned by completing AchievementGoals within a BadgeCollection
- **Earning Method**: Automatic when user meets goal requirements (e.g., "Create 10 experience posts")
- **Characteristics**:
  - Always linked to a BadgeCollection (`collectionId` is set)
  - Reward is specified in AchievementGoal (`rewardBadgeId`)
  - Can have boostMultiplier and rewardMultiplier for gameplay effects
- **Example**: "Experience Master" badge earned after creating 50 experience posts

### EVENT
- **Purpose**: Awarded to top performers after events end
- **Earning Method**: Distributed via EventBadgeDistributorService based on rankings
- **Characteristics**:
  - Linked to specific events
  - Rank-based distribution (1st place, 2nd place, 3rd place)
  - Typically higher point value (1.5x multiplier)
  - Limited availability (only top users receive)
- **Example**: "Event Champion 2026" badge for 1st place in a competition

### COSMETIC
- **Purpose**: Visual-only badges for customization and fun
- **Earning Method**: Various (special events, promotions, purchases)
- **Characteristics**:
  - No gameplay effect (boostMultiplier and rewardMultiplier are null)
  - Lower point value (0.5x multiplier)
  - Focus on aesthetic appeal
- **Example**: "Rainbow Badge" for profile decoration

### BRAND
- **Purpose**: Brand partnership and sponsored badges
- **Earning Method**: Special promotions, brand interactions, sponsored content
- **Characteristics**:
  - Highest point value (2.0x multiplier)
  - May include brand logo/imagery
  - Can have special privileges (exclusive content access)
- **Example**: "Nike Partner" badge for brand collaboration

## Badge Rarity (BadgeRarity Enum)

Rarity determines badge value and visual treatment:

### COMMON
- **Base Points**: 10
- **Boost Multiplier**: 1.0
- **Reward Multiplier**: 1.0
- **Visual**: Standard color scheme (gray/silver)
- **Distribution**: Most badges are COMMON
- **Example**: "First Post" badge

### RARE
- **Base Points**: 30
- **Boost Multiplier**: 1.5
- **Reward Multiplier**: 2.0
- **Visual**: Enhanced color scheme (blue/purple)
- **Distribution**: ~20-30% of badges
- **Example**: "100 Posts Created" badge

### EPIC
- **Base Points**: 50
- **Boost Multiplier**: 2.0
- **Reward Multiplier**: 3.0
- **Visual**: Premium color scheme (gold/animated)
- **Distribution**: ~5-10% of badges
- **Example**: "Legendary Contributor" badge

## Badge Properties

### Database Schema

```prisma
model Badge {
  id                String      @id @default(uuid()) @db.Uuid
  name              String      @db.VarChar(500)
  description       String?     @db.VarChar(2000)
  imageUrl          String?     @db.VarChar(1000)
  type              BadgeType
  rarity            BadgeRarity
  boostMultiplier   Decimal?    @db.Decimal(5, 2)
  rewardMultiplier  Decimal?    @db.Decimal(5, 2)
  categoryId        String      @map("category_id") @db.Uuid
  collectionId      String?     @map("collection_id") @db.Uuid
  createdAt         DateTime    @default(now()) @map("created_at")

  category          BadgeCategory      @relation(fields: [categoryId], references: [id])
  collection        BadgeCollection?   @relation(fields: [collectionId], references: [id])
  userBadges        UserBadge[]

  @@map("badges")
}
```

### Field Descriptions

**id** (UUID, Primary Key)
- Unique identifier for the badge
- Generated automatically on creation

**name** (String, 1-500 chars, Required)
- Display name of the badge
- Should be concise and descriptive
- Examples: "Experience Master", "Event Champion", "First Post"

**description** (String, max 2000 chars, Nullable)
- Detailed description of the badge
- Explains how to earn it or what it represents
- Supports basic markdown formatting
- Example: "Awarded to users who have created 50 experience posts. Share your travel adventures and earn this prestigious badge!"

**imageUrl** (String, URL, Nullable)
- URL to badge image/icon
- Stored in MinIO/S3
- Recommended size: 256x256px PNG with transparency
- If null, default badge icon is used

**type** (BadgeType Enum, Required)
- One of: COLLECTION, EVENT, COSMETIC, BRAND
- Determines earning mechanism and point calculation

**rarity** (BadgeRarity Enum, Required)
- One of: COMMON, RARE, EPIC
- Affects point value and visual treatment

**boostMultiplier** (Decimal, 2 decimals, Nullable)
- Gameplay speed multiplier (if applicable)
- Range: 1.0 to 5.0
- Null for COSMETIC badges
- Example: 1.5 means 50% faster gameplay

**rewardMultiplier** (Decimal, 2 decimals, Nullable)
- Reward amount multiplier (if applicable)
- Range: 1.0 to 5.0
- Null for COSMETIC badges
- Example: 2.0 means 2x rewards

**categoryId** (UUID, Required)
- Links to BadgeCategory (Achievement Badges, Event Badges, etc.)
- Used for filtering and organization

**collectionId** (UUID, Nullable)
- Links to BadgeCollection for COLLECTION type badges
- Null for EVENT, COSMETIC, BRAND types

**createdAt** (DateTime, Auto-generated)
- Timestamp when badge was created
- Used for sorting and analytics

## Badge Categories

Pre-seeded categories for badge organization:

### Achievement Badges
- **Purpose**: Badges earned through gameplay and content creation
- **Examples**: "First Post", "100 Likes Received", "Comment Champion"

### Event Badges
- **Purpose**: Badges from event participation and rankings
- **Examples**: "Event Champion 2026", "Runner-Up", "Participant"

### Community Badges
- **Purpose**: Badges for community engagement and social activity
- **Examples**: "Helpful Helper", "Trusted Friend", "Mentor"

### Special Badges
- **Purpose**: Limited edition, admin-granted, or unique badges
- **Examples**: "Beta Tester", "Founder", "VIP"

**Note**: Custom categories can be created via admin panel.

## Badge Lifecycle

```
Created (Admin) → Assigned (Auto/Manual) → Unclaimed → Claimed → Displayed
                                         ↓
                                      Hidden (visibility=PRIVATE)
```

### 1. Created
- Admin creates badge via `/admin/badges` endpoint
- Badge exists in system but not yet earned by any user

### 2. Assigned (Auto)
- User completes AchievementGoal → Badge automatically assigned
- Event ends → Top users automatically assigned event badges
- UserBadge record created with `claimed=false`

### 2. Assigned (Manual)
- Admin grants badge to specific user(s) via `/admin/users/:id/badges` endpoint
- Bulk grant via `/admin/badges/bulk-grant` for multiple users

### 3. Unclaimed
- Badge appears in user's `/api/profile/badges` with `claimed=false`
- User receives NEW_BADGE notification
- Badge shown in "Pending Rewards" section of profile

### 4. Claimed
- User calls `POST /api/profile/badges/:badgeId/claim`
- `claimed=true`, `claimedAt=now()`
- Badge moves to "Earned Badges" section
- Contributes to user's total points and level

### 5. Displayed
- User can showcase up to 6 badges on profile
- Controlled by `displayOrder` field (1-6)
- Other users see badges based on visibility settings

### 6. Hidden (Optional)
- User can set `visibility=PRIVATE` to hide badge
- Badge still earned and claimed, but not shown to others

## UserBadge Properties

Represents a badge earned by a specific user.

### Database Schema

```prisma
model UserBadge {
  id           String          @id @default(uuid()) @db.Uuid
  userId       String          @map("user_id") @db.Uuid
  badgeId      String          @map("badge_id") @db.Uuid
  claimed      Boolean         @default(false)
  claimedAt    DateTime?       @map("claimed_at")
  isVisible    Boolean         @default(true) @map("is_visible")
  displayOrder Int?            @map("display_order") @db.Integer
  visibility   BadgeVisibility @default(PUBLIC)
  createdAt    DateTime        @default(now()) @map("created_at")

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  badge Badge @relation(fields: [badgeId], references: [id], onDelete: Cascade)

  @@unique([userId, badgeId])
  @@map("user_badges")
}
```

### Field Descriptions

**claimed** (Boolean, Default: false)
- Whether user has claimed the badge
- false: Badge appears in "Pending Rewards"
- true: Badge appears in "Earned Badges" and contributes to points

**claimedAt** (DateTime, Nullable)
- Timestamp when user claimed the badge
- Null until claimed
- Used for sorting recently claimed badges

**isVisible** (Boolean, Default: true)
- Whether badge is shown on profile
- false: Hidden from profile showcase
- Separate from visibility (which controls who can see it)

**displayOrder** (Integer, Nullable)
- Order for profile showcase (1-6)
- Null: Not in showcase
- 1-6: Position in showcase (1 = first)
- User can update via `/api/profile/badges/display-order`

**visibility** (BadgeVisibility Enum, Default: PUBLIC)
- Controls who can see the badge
- See Badge Visibility Rules section below

## Badge Visibility Rules

### PUBLIC
- **Who Can See**: All users, including anonymous visitors
- **Use Case**: Default visibility for most badges
- **Example**: Achievement badges, event badges

### FRIENDS
- **Who Can See**: Users who are friends with badge owner
- **Use Case**: Badges user wants to share with friends only
- **Example**: Personal achievement badges
- **Implementation**: Requires friendship relation in database

### TRUSTERS
- **Who Can See**: Users who trust the badge owner (follower-like relationship)
- **Use Case**: Badges visible to followers/fans
- **Example**: Influencer badges, brand partnerships
- **Implementation**: Requires trust relation in database

### PRIVATE
- **Who Can See**: Only the badge owner
- **Use Case**: Badges user wants to keep private
- **Example**: Sensitive achievements, admin-granted badges
- **Implementation**: Badge not shown in public profile queries

### Visibility Enforcement

**In API Queries**:
```typescript
// Get user's public badges
const publicBadges = await prisma.userBadge.findMany({
  where: {
    userId: targetUserId,
    isVisible: true,
    visibility: 'PUBLIC',
    claimed: true,
  },
  include: { badge: true },
});

// Get badges visible to requester
const visibleBadges = await prisma.userBadge.findMany({
  where: {
    userId: targetUserId,
    isVisible: true,
    claimed: true,
    OR: [
      { visibility: 'PUBLIC' },
      { visibility: 'FRIENDS', user: { friends: { some: { id: requesterId } } } },
      { visibility: 'TRUSTERS', user: { trustedBy: { some: { id: requesterId } } } },
      { userId: requesterId }, // Always show own badges
    ],
  },
  include: { badge: true },
});
```

## Badge Display

### Profile Showcase
- **Limit**: Up to 6 badges
- **Ordering**: Controlled by `displayOrder` field (1-6)
- **Update**: `PUT /api/profile/badges/display-order`
- **Default Order**: Most recently claimed badges first

### Pending Rewards Section
- **Filter**: `claimed=false`
- **Sorting**: Most recently earned (createdAt desc)
- **Action**: User can claim badge
- **Notification**: NEW_BADGE notification when badge is earned

### Earned Badges Gallery
- **Filter**: `claimed=true`
- **Pagination**: 20 badges per page
- **Sorting**: Recently claimed, rarity, type
- **Filters**: By rarity, type, category

## Badge Metrics & Point Calculation

### Point Value Formula

```typescript
function calculateBadgePoints(rarity: BadgeRarity, type: BadgeType): number {
  // Base points from rarity
  let basePoints = 0;
  switch (rarity) {
    case 'COMMON': basePoints = 10; break;
    case 'RARE':   basePoints = 30; break;
    case 'EPIC':   basePoints = 50; break;
  }

  // Type multiplier
  let multiplier = 1.0;
  switch (type) {
    case 'COLLECTION': multiplier = 1.0; break;
    case 'EVENT':      multiplier = 1.5; break;
    case 'COSMETIC':   multiplier = 0.5; break;
    case 'BRAND':      multiplier = 2.0; break;
  }

  return Math.floor(basePoints * multiplier);
}
```

### Point Value Table

| Rarity | COLLECTION | EVENT | COSMETIC | BRAND |
|--------|-----------|-------|----------|-------|
| COMMON | 10        | 15    | 5        | 20    |
| RARE   | 30        | 45    | 15       | 60    |
| EPIC   | 50        | 75    | 25       | 100   |

### Badge Statistics

**User Level Calculation**:
- Total points = Sum of all claimed badge points
- Level = floor(totalPoints / 100) + 1
- Example: 450 points → Level 5

**Rarity Distribution** (Recommended):
- COMMON: 60-70% of badges
- RARE: 20-30% of badges
- EPIC: 5-10% of badges

**Type Distribution** (Typical):
- COLLECTION: 50-60% (main earning method)
- EVENT: 20-30% (seasonal, time-limited)
- COSMETIC: 10-15% (fun, low-value)
- BRAND: 5-10% (partnerships)

## Badge Creation Guidelines (Admin)

### Naming Conventions
- Use title case: "Experience Master", not "experience master"
- Be descriptive but concise (under 50 characters ideal)
- Avoid redundant words: "100 Posts" not "100 Posts Badge"

### Description Best Practices
- Explain earning criteria clearly
- Include motivational language
- Mention any special benefits (boost/reward multipliers)
- Keep under 200 characters for mobile display

### Image Guidelines
- Size: 256x256px PNG with transparency
- Style: Consistent with app design system
- Rarity: Use color coding (gray=COMMON, blue=RARE, gold=EPIC)
- Format: High-quality, scalable graphics

### Rarity Assignment
- COMMON: Achievable by most users (50%+ should earn)
- RARE: Requires significant effort (20-30% earn rate)
- EPIC: Rare achievements (5-10% earn rate)

### Multiplier Guidelines
- boostMultiplier: Only for badges that affect gameplay speed
  - COMMON: 1.0-1.2
  - RARE: 1.3-1.5
  - EPIC: 1.6-2.0
- rewardMultiplier: Only for badges that affect rewards
  - COMMON: 1.0-1.5
  - RARE: 1.5-2.5
  - EPIC: 2.5-3.0

## API Endpoints Summary

### User Endpoints
- `GET /api/badges` - List all badges (public)
- `GET /api/badges/:id` - Get badge details with recent earners
- `GET /api/profile/badges` - Get my badges (claimed and unclaimed)
- `POST /api/profile/badges/:badgeId/claim` - Claim a badge
- `PUT /api/profile/badges/:userBadgeId/visibility` - Update visibility
- `PUT /api/profile/badges/display-order` - Update showcase order

### Admin Endpoints
- `GET /admin/badges` - List all badges with filters
- `POST /admin/badges` - Create new badge
- `PATCH /admin/badges/:id` - Update badge
- `DELETE /admin/badges/:id` - Delete badge (cascade deletes UserBadges)
- `POST /admin/users/:userId/badges` - Grant badge to user
- `DELETE /admin/users/:userId/badges/:badgeId` - Remove badge from user
- `POST /admin/badges/bulk-grant` - Grant badge to multiple users

## Error Handling

### Common Errors

**404 - Badge Not Found**
```json
{
  "success": false,
  "message": "Badge not found"
}
```

**400 - Badge Already Claimed**
```json
{
  "success": false,
  "message": "Badge already claimed"
}
```

**409 - Duplicate Badge Grant**
```json
{
  "success": false,
  "message": "User already has this badge"
}
```

**400 - Invalid Display Order**
```json
{
  "success": false,
  "message": "Display order must be between 1 and 6"
}
```

---

**Document Version**: 1.0
**Last Updated**: 2026-02-11
**Related Specs**: 02_COLLECTION_SYSTEM_SPEC.md, 04_EARNING_MECHANISMS_SPEC.md
