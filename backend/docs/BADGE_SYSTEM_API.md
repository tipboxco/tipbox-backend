# Badge System API Documentation

**Version:** 2.0
**Last Updated:** 2026-02-26
**Status:** Ready for Integration

## Overview

This document describes the updated Badge System API endpoints for the Tipbox mobile application. These endpoints provide comprehensive badge management including listing, detail view, and profile highlight badge selection.

## Table of Contents

- [Breaking Changes](#breaking-changes)
- [Migration Guide](#migration-guide)
- [Endpoints](#endpoints)
  - [EP-01: List User Badges](#ep-01-list-user-badges)
  - [EP-03: Get Badge Detail](#ep-03-get-badge-detail)
  - [EP-05: Get Highlight Badge Selection Data](#ep-05-get-highlight-badge-selection-data)
  - [EP-06: Update Highlight Badges](#ep-06-update-highlight-badges)
  - [EP-07: User Profile (Updated)](#ep-07-user-profile-updated)
- [Data Models](#data-models)
- [Enum Mappings](#enum-mappings)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Breaking Changes

### ⚠️ Profile Endpoint Changes (EP-07)

**Endpoint:** `GET /users/:id/profile`

**What Changed:**
1. **Badge count reduced**: Now returns max **4 badges** (was 6)
2. **Badge filtering**: Only shows badges with `isVisible=true` and `displayOrder` 0-3
3. **New badge fields**: Each badge now includes:
   - `type`: `"achievement"` or `"bridge"`
   - `earnedAt`: ISO8601 timestamp
   - `rarity`: `"Usual"`, `"Rare"`, `"Epic"`, or `"Legendary"`
   - `owner`: Total earned count as string (e.g., `"1234"`)

**Before:**
```json
{
  "badges": [
    {
      "id": "badge-uuid",
      "title": "Early Adopter",
      "image": "https://cdn.tipbox.com/badges/early-adopter.png"
    }
  ]
}
```

**After:**
```json
{
  "badges": [
    {
      "id": "badge-uuid",
      "title": "Early Adopter",
      "image": "https://cdn.tipbox.com/badges/early-adopter.png",
      "type": "achievement",
      "earnedAt": "2026-01-15T10:30:00.000Z",
      "rarity": "Rare",
      "owner": "1234"
    }
  ]
}
```

### Enum Value Changes

| Database Value | Frontend Value | Notes |
|---------------|---------------|-------|
| `COMMON` | `Usual` | Rarity mapping |
| `RARE` | `Rare` | Rarity mapping |
| `EPIC` | `Epic` | Rarity mapping |
| `LEGENDARY` | `Legendary` | ⭐ NEW rarity tier |
| `BRAND` | `bridge` | Badge type (category) |
| `COLLECTION` | `achievement` | Badge type (category) |
| `EVENT` | `achievement` | Badge type (category) |
| `COSMETIC` | `achievement` | Badge type (category) |

---

## Migration Guide

### Step 1: Update Profile Badge Model

```typescript
// OLD
interface ProfileBadge {
  id: string;
  title: string;
  image: string | null;
}

// NEW
interface ProfileBadge {
  id: string;
  title: string;
  image: string | null;
  type: 'achievement' | 'bridge';      // NEW
  earnedAt: string | null;             // NEW (ISO8601)
  rarity: 'Usual' | 'Rare' | 'Epic' | 'Legendary';  // NEW
  owner: string;                       // NEW (total earned count)
}
```

### Step 2: Update Rarity Display

```typescript
// Add new rarity color/styling
const RARITY_COLORS = {
  Usual: '#94A3B8',      // gray
  Rare: '#3B82F6',       // blue
  Epic: '#A855F7',       // purple
  Legendary: '#F59E0B',  // gold ⭐ NEW
};
```

### Step 3: Handle Max 4 Badges

```typescript
// Profile screen - expect max 4 badges
const ProfileBadges = ({ badges }: { badges: ProfileBadge[] }) => {
  // Backend now returns max 4 badges with displayOrder 0-3
  return (
    <BadgeGrid columns={2}>
      {badges.map(badge => (
        <BadgeCard key={badge.id} badge={badge} />
      ))}
    </BadgeGrid>
  );
};
```

---

## Endpoints

### EP-01: List User Badges

Get a paginated list of user's badges separated by category (achievement/bridge).

**Endpoint:** `GET /users/:id/collections/bridges`

**Authentication:** Optional (shows viewer's progress if authenticated)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | No | 20 | Items per page (1-50) |
| `cursor` | string | No | - | Pagination cursor (last item's ID) |

**Response:**

```json
{
  "brand": {
    "items": [
      {
        "id": "badge-uuid",
        "title": "Samsung Galaxy Expert",
        "image": "https://cdn.tipbox.com/badges/samsung.png",
        "rarity": "Rare",
        "isClaimed": true,
        "nftAddress": null,
        "totalEarned": 1234,
        "earnedDate": "2026-01-15T10:30:00.000Z",
        "tasks": [
          {
            "id": "task-uuid",
            "title": "Post 5 Samsung reviews",
            "type": "Share",
            "current": 5,
            "total": 5,
            "isCompleted": true
          }
        ]
      }
    ]
  },
  "achievement": {
    "items": [
      {
        "id": "badge-uuid-2",
        "title": "Tech Enthusiast",
        "image": "https://cdn.tipbox.com/badges/tech-enthusiast.png",
        "rarity": "Epic",
        "isClaimed": true,
        "nftAddress": null,
        "totalEarned": 5678,
        "earnedDate": "2026-02-01T14:20:00.000Z",
        "tasks": [
          {
            "id": "task-uuid-3",
            "title": "Comment on 20 posts",
            "type": "Comment",
            "current": 20,
            "total": 20,
            "isCompleted": true
          }
        ]
      }
    ]
  },
  "pagination": {
    "cursor": "last-badge-uuid",
    "hasMore": true,
    "limit": 20
  }
}
```

**Example Request:**

```bash
# First page
curl https://api.tipbox.com/users/123e4567-e89b-12d3-a456-426614174000/collections/bridges?limit=20

# Next page
curl https://api.tipbox.com/users/123e4567-e89b-12d3-a456-426614174000/collections/bridges?limit=20&cursor=badge-uuid-last
```

**TypeScript Interface:**

```typescript
interface BadgeListResponse {
  brand: {
    items: BadgeListItem[];
  };
  achievement: {
    items: BadgeListItem[];
  };
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

interface BadgeListItem {
  id: string;
  title: string;
  image: string | null;
  rarity: 'Usual' | 'Rare' | 'Epic' | 'Legendary';
  isClaimed: boolean;
  nftAddress: string | null;
  totalEarned: number;
  earnedDate: string | null;  // ISO8601
  tasks: BadgeTask[];
}

interface BadgeTask {
  id: string;
  title: string;
  type: 'Comment' | 'Like' | 'Share';
  current: number;
  total: number;
  isCompleted: boolean;
}
```

---

### EP-03: Get Badge Detail

Get detailed information about a specific badge including task progress.

**Endpoint:** `GET /users/:id/collections/bridges/:badgeId`

**Authentication:** Optional (shows viewer's progress if authenticated)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | User ID (UUID) |
| `badgeId` | string | Badge ID (UUID) |

**Response:**

```json
{
  "id": "badge-uuid",
  "title": "Samsung Galaxy Expert",
  "image": "https://cdn.tipbox.com/badges/samsung.png",
  "rarity": "Rare",
  "isClaimed": true,
  "nftAddress": null,
  "totalEarned": 1234,
  "earnedDate": "2026-01-15T10:30:00.000Z",
  "description": "Become a Samsung Galaxy expert by sharing your knowledge and experiences.",
  "tasks": [
    {
      "id": "task-uuid-1",
      "title": "Post 5 Samsung reviews",
      "type": "Share",
      "current": 5,
      "total": 5,
      "isCompleted": true
    },
    {
      "id": "task-uuid-2",
      "title": "Like 10 Samsung posts",
      "type": "Like",
      "current": 7,
      "total": 10,
      "isCompleted": false
    }
  ]
}
```

**Example Request:**

```bash
curl https://api.tipbox.com/users/123e4567-e89b-12d3-a456-426614174000/collections/bridges/badge-uuid-123
```

**TypeScript Interface:**

```typescript
interface BadgeDetailResponse {
  id: string;
  title: string;
  image: string | null;
  rarity: 'Usual' | 'Rare' | 'Epic' | 'Legendary';
  isClaimed: boolean;
  nftAddress: string | null;
  totalEarned: number;
  earnedDate: string | null;
  description: string | null;
  tasks: BadgeTask[];
}
```

**Error Responses:**

```json
// 404 - Badge not found
{
  "message": "Badge not found"
}
```

---

### EP-05: Get Highlight Badge Selection Data

Get current highlight badges and available badges for the highlight badge picker UI.

**Endpoint:** `GET /users/me/highlight-badges`

**Authentication:** Required (Bearer token)

**Response:**

```json
{
  "selectedBadgeIds": [
    "badge-uuid-1",
    "badge-uuid-2",
    "badge-uuid-3"
  ],
  "availableBadges": {
    "event": [
      {
        "id": "badge-uuid-4",
        "title": "Summer Sale Participant",
        "image": "https://cdn.tipbox.com/badges/summer-sale.png",
        "rarity": "Usual"
      }
    ],
    "collection": [
      {
        "id": "badge-uuid-5",
        "title": "Tech Enthusiast",
        "image": "https://cdn.tipbox.com/badges/tech.png",
        "rarity": "Epic"
      },
      {
        "id": "badge-uuid-6",
        "title": "Samsung Expert",
        "image": "https://cdn.tipbox.com/badges/samsung.png",
        "rarity": "Rare"
      }
    ]
  }
}
```

**Example Request:**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.tipbox.com/users/me/highlight-badges
```

**TypeScript Interface:**

```typescript
interface HighlightBadgeSelectionData {
  selectedBadgeIds: string[];  // max 4
  availableBadges: {
    event: HighlightBadgeItem[];
    collection: HighlightBadgeItem[];
  };
}

interface HighlightBadgeItem {
  id: string;
  title: string;
  image: string | null;
  rarity: 'Usual' | 'Rare' | 'Epic' | 'Legendary';
}
```

**UI Implementation Example:**

```typescript
const HighlightBadgePicker = () => {
  const [data, setData] = useState<HighlightBadgeSelectionData | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    fetch('/users/me/highlight-badges', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setData(data);
        setSelected(data.selectedBadgeIds);
      });
  }, []);

  const toggleBadge = (badgeId: string) => {
    if (selected.includes(badgeId)) {
      setSelected(selected.filter(id => id !== badgeId));
    } else if (selected.length < 4) {
      setSelected([...selected, badgeId]);
    } else {
      alert('Maximum 4 badges allowed');
    }
  };

  // ... render logic
};
```

---

### EP-06: Update Highlight Badges

Update user's highlight badges (max 4) for their profile.

**Endpoint:** `PUT /users/me/highlight-badges`

**Authentication:** Required (Bearer token)

**Request Body:**

```json
{
  "badgeIds": [
    "badge-uuid-1",
    "badge-uuid-2",
    "badge-uuid-3",
    "badge-uuid-4"
  ]
}
```

**Validation Rules:**
- Max 4 badge IDs
- All badges must be owned by the user
- All badges must be claimed (`claimed: true`)
- Badge IDs must be valid UUIDs

**Response:**

```json
{
  "success": true,
  "badgeIds": [
    "badge-uuid-1",
    "badge-uuid-2",
    "badge-uuid-3",
    "badge-uuid-4"
  ]
}
```

**Example Request:**

```bash
curl -X PUT https://api.tipbox.com/users/me/highlight-badges \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "badgeIds": [
      "123e4567-e89b-12d3-a456-426614174001",
      "123e4567-e89b-12d3-a456-426614174002"
    ]
  }'
```

**TypeScript Interface:**

```typescript
interface UpdateHighlightBadgesRequest {
  badgeIds: string[];  // max 4
}

interface UpdateHighlightBadgesResponse {
  success: boolean;
  badgeIds: string[];
}
```

**Error Responses:**

```json
// 400 - Too many badges
{
  "success": false,
  "message": "Maximum 4 highlight badges allowed"
}

// 400 - Badge not owned
{
  "success": false,
  "message": "Some badges are not owned or not claimed"
}

// 400 - Invalid format
{
  "success": false,
  "message": "badgeIds must be an array"
}

// 401 - Unauthorized
{
  "message": "Unauthorized"
}
```

---

### EP-07: User Profile (Updated)

**⚠️ BREAKING CHANGE:** This endpoint now returns updated badge format.

**Endpoint:** `GET /users/:id/profile`

**Authentication:** Optional (shows isTrusted if authenticated)

**Changes:**
- Returns max **4 badges** (was 6)
- Badges now include `type`, `earnedAt`, `rarity`, `owner` fields

**Response:**

```json
{
  "id": "user-uuid",
  "name": "John Doe",
  "avatar": "https://cdn.tipbox.com/avatars/john.jpg",
  "banner": "https://cdn.tipbox.com/banners/john.jpg",
  "biography": "Tech enthusiast and reviewer",
  "cosmetic": "cosmetic-badge-uuid",
  "cosmeticDetail": {
    "id": "cosmetic-badge-uuid",
    "title": "Gold Frame",
    "image": "https://cdn.tipbox.com/cosmetics/gold-frame.png"
  },
  "titles": ["Early Adopter", "Tech Expert"],
  "stats": {
    "posts": 123,
    "trust": 456,
    "truster": 789
  },
  "badges": [
    {
      "id": "badge-uuid-1",
      "title": "Samsung Expert",
      "image": "https://cdn.tipbox.com/badges/samsung.png",
      "type": "bridge",
      "earnedAt": "2026-01-15T10:30:00.000Z",
      "rarity": "Rare",
      "owner": "1234"
    },
    {
      "id": "badge-uuid-2",
      "title": "Tech Enthusiast",
      "image": "https://cdn.tipbox.com/badges/tech.png",
      "type": "achievement",
      "earnedAt": "2026-02-01T14:20:00.000Z",
      "rarity": "Epic",
      "owner": "5678"
    }
  ]
}
```

**Example Request:**

```bash
curl https://api.tipbox.com/users/123e4567-e89b-12d3-a456-426614174000/profile
```

---

## Data Models

### Complete TypeScript Types

```typescript
// ============================================
// Badge List (EP-01)
// ============================================

interface BadgeListResponse {
  brand: {
    items: BadgeListItem[];
  };
  achievement: {
    items: BadgeListItem[];
  };
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

interface BadgeListItem {
  id: string;
  title: string;
  image: string | null;
  rarity: BadgeRarity;
  isClaimed: boolean;
  nftAddress: string | null;
  totalEarned: number;
  earnedDate: string | null;  // ISO8601
  tasks: BadgeTask[];
}

// ============================================
// Badge Detail (EP-03)
// ============================================

interface BadgeDetailResponse {
  id: string;
  title: string;
  image: string | null;
  rarity: BadgeRarity;
  isClaimed: boolean;
  nftAddress: string | null;
  totalEarned: number;
  earnedDate: string | null;
  description: string | null;
  tasks: BadgeTask[];
}

// ============================================
// Highlight Badges (EP-05, EP-06)
// ============================================

interface HighlightBadgeSelectionData {
  selectedBadgeIds: string[];
  availableBadges: {
    event: HighlightBadgeItem[];
    collection: HighlightBadgeItem[];
  };
}

interface HighlightBadgeItem {
  id: string;
  title: string;
  image: string | null;
  rarity: BadgeRarity;
}

interface UpdateHighlightBadgesRequest {
  badgeIds: string[];  // max 4, must be owned & claimed
}

interface UpdateHighlightBadgesResponse {
  success: boolean;
  badgeIds: string[];
}

// ============================================
// Profile Badge (EP-07)
// ============================================

interface ProfileBadge {
  id: string;
  title: string;
  image: string | null;
  type: BadgeCategory;
  earnedAt: string | null;
  rarity: BadgeRarity;
  owner: string;  // total earned count as string
}

// ============================================
// Shared Types
// ============================================

interface BadgeTask {
  id: string;
  title: string;
  type: TaskType;
  current: number;
  total: number;
  isCompleted: boolean;
}

type BadgeRarity = 'Usual' | 'Rare' | 'Epic' | 'Legendary';
type BadgeCategory = 'achievement' | 'bridge';
type TaskType = 'Comment' | 'Like' | 'Share';
```

---

## Enum Mappings

### Badge Rarity

| Backend (DB) | Frontend | Color Suggestion | Icon |
|-------------|----------|------------------|------|
| `COMMON` | `Usual` | `#94A3B8` (Gray) | ⚪ |
| `RARE` | `Rare` | `#3B82F6` (Blue) | 🔵 |
| `EPIC` | `Epic` | `#A855F7` (Purple) | 🟣 |
| `LEGENDARY` | `Legendary` | `#F59E0B` (Gold) | 🟡 |

### Badge Category (Type)

| Backend (DB) | Frontend | Tab | Description |
|-------------|----------|-----|-------------|
| `BRAND` | `bridge` | Bridge | Brand/partnership badges |
| `COLLECTION` | `achievement` | Achievement | Collection badges |
| `EVENT` | `achievement` | Achievement | Event participation badges |
| `COSMETIC` | `achievement` | Achievement | Cosmetic badges |

### Task Type

| Backend (DB) | Frontend | Icon Suggestion |
|-------------|----------|-----------------|
| `COMMENT` | `Comment` | 💬 |
| `LIKE` | `Like` | ❤️ |
| `POST` | `Share` | 📤 |
| `BOOKMARK` | `Share` | 📤 |
| `JOIN` | `Share` | 📤 |
| `SYSTEM` | `Share` | 📤 |

---

## Error Handling

### Standard Error Response Format

```json
{
  "message": "Error description",
  "success": false
}
```

### HTTP Status Codes

| Code | Description | Example |
|------|-------------|---------|
| 200 | Success | Badge list retrieved |
| 201 | Created | Highlight badges updated |
| 400 | Bad Request | Invalid limit, too many badges |
| 401 | Unauthorized | Missing/invalid token |
| 404 | Not Found | Badge doesn't exist |
| 500 | Server Error | Database error |

### Common Errors

```typescript
// EP-01: List Badges
{
  "success": false,
  "message": "Limit must be between 1 and 50"
}

// EP-03: Badge Detail
{
  "message": "Badge not found"
}

// EP-06: Update Highlights
{
  "success": false,
  "message": "Maximum 4 highlight badges allowed"
}

{
  "success": false,
  "message": "Some badges are not owned or not claimed"
}

{
  "success": false,
  "message": "badgeIds must be an array"
}

// Authentication
{
  "message": "Unauthorized"
}
```

---

## Examples

### Example 1: Display User's Badge Collection

```typescript
import { useState, useEffect } from 'react';

const UserBadgeCollection = ({ userId }: { userId: string }) => {
  const [badges, setBadges] = useState<BadgeListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/users/${userId}/collections/bridges?limit=20`)
      .then(res => res.json())
      .then(data => {
        setBadges(data);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, [userId]);

  if (loading) return <Spinner />;

  return (
    <div>
      <Section title="Bridge Badges">
        <BadgeGrid badges={badges?.brand.items || []} />
      </Section>

      <Section title="Achievement Badges">
        <BadgeGrid badges={badges?.achievement.items || []} />
      </Section>
    </div>
  );
};
```

### Example 2: Badge Detail Modal

```typescript
const BadgeDetailModal = ({
  userId,
  badgeId,
  onClose
}: {
  userId: string;
  badgeId: string;
  onClose: () => void;
}) => {
  const [badge, setBadge] = useState<BadgeDetailResponse | null>(null);

  useEffect(() => {
    fetch(`/users/${userId}/collections/bridges/${badgeId}`)
      .then(res => res.json())
      .then(data => setBadge(data));
  }, [userId, badgeId]);

  if (!badge) return <Spinner />;

  return (
    <Modal onClose={onClose}>
      <BadgeHeader
        title={badge.title}
        image={badge.image}
        rarity={badge.rarity}
      />

      <BadgeStats
        totalEarned={badge.totalEarned}
        earnedDate={badge.earnedDate}
      />

      <BadgeDescription text={badge.description} />

      <TaskList>
        {badge.tasks.map(task => (
          <TaskItem
            key={task.id}
            title={task.title}
            type={task.type}
            progress={`${task.current}/${task.total}`}
            completed={task.isCompleted}
          />
        ))}
      </TaskList>
    </Modal>
  );
};
```

### Example 3: Highlight Badge Picker

```typescript
const HighlightBadgePicker = ({ onSave }: { onSave: () => void }) => {
  const [data, setData] = useState<HighlightBadgeSelectionData | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/users/me/highlight-badges', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setData(data);
        setSelected(data.selectedBadgeIds);
      });
  }, []);

  const toggleBadge = (badgeId: string) => {
    if (selected.includes(badgeId)) {
      setSelected(selected.filter(id => id !== badgeId));
    } else if (selected.length < 4) {
      setSelected([...selected, badgeId]);
    } else {
      alert('Maximum 4 badges allowed');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/users/me/highlight-badges', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ badgeIds: selected }),
      });

      if (response.ok) {
        onSave();
      } else {
        const error = await response.json();
        alert(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <Spinner />;

  return (
    <div>
      <Header>
        Select up to 4 badges ({selected.length}/4)
      </Header>

      <Section title="Event Badges">
        <BadgeGrid>
          {data.availableBadges.event.map(badge => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              selected={selected.includes(badge.id)}
              onToggle={() => toggleBadge(badge.id)}
            />
          ))}
        </BadgeGrid>
      </Section>

      <Section title="Collection Badges">
        <BadgeGrid>
          {data.availableBadges.collection.map(badge => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              selected={selected.includes(badge.id)}
              onToggle={() => toggleBadge(badge.id)}
            />
          ))}
        </BadgeGrid>
      </Section>

      <Button
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Save Highlights'}
      </Button>
    </div>
  );
};
```

### Example 4: Profile Badges Display

```typescript
const ProfileBadges = ({ userId }: { userId: string }) => {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch(`/users/${userId}/profile`)
      .then(res => res.json())
      .then(data => setProfile(data));
  }, [userId]);

  if (!profile) return <Spinner />;

  return (
    <BadgeSection>
      <SectionTitle>
        Highlight Badges ({profile.badges.length}/4)
      </SectionTitle>

      <BadgeGrid columns={2}>
        {profile.badges.map((badge: ProfileBadge) => (
          <BadgeCard key={badge.id}>
            <BadgeImage src={badge.image} />
            <BadgeTitle>{badge.title}</BadgeTitle>
            <RarityBadge rarity={badge.rarity} />
            <BadgeType type={badge.type} />
            <BadgeStats>
              {badge.owner} people earned
            </BadgeStats>
            <EarnedDate>
              {new Date(badge.earnedAt).toLocaleDateString()}
            </EarnedDate>
          </BadgeCard>
        ))}
      </BadgeGrid>
    </BadgeSection>
  );
};
```

---

## Testing Checklist

### EP-01: List Badges
- [ ] Fetch first page with default limit (20)
- [ ] Fetch with custom limit (10)
- [ ] Fetch with limit > 50 (should return 400)
- [ ] Fetch next page using cursor
- [ ] Verify `brand.items` contains only BRAND type badges
- [ ] Verify `achievement.items` contains COLLECTION/EVENT/COSMETIC badges
- [ ] Verify `pagination.hasMore` is correct
- [ ] Verify task progress shows correctly

### EP-03: Badge Detail
- [ ] Fetch badge detail for owned badge
- [ ] Fetch badge detail for unowned badge
- [ ] Verify task progress is accurate
- [ ] Verify `description` field is present
- [ ] Handle 404 for non-existent badge

### EP-05: Get Highlight Selection
- [ ] Fetch with valid token
- [ ] Verify `selectedBadgeIds` contains current highlights
- [ ] Verify `availableBadges.event` has event badges
- [ ] Verify `availableBadges.collection` has collection badges
- [ ] Handle 401 for missing token

### EP-06: Update Highlights
- [ ] Save 1 badge successfully
- [ ] Save 4 badges successfully
- [ ] Try to save 5 badges (should return 400)
- [ ] Try to save unowned badge (should return 400)
- [ ] Verify profile updates after save

### EP-07: Profile (Updated)
- [ ] Verify max 4 badges returned
- [ ] Verify new fields present: `type`, `earnedAt`, `rarity`, `owner`
- [ ] Verify enum mappings (COMMON → Usual)
- [ ] Update mobile app to handle new format

---

## Support

For questions or issues with these APIs, please contact:

- **Backend Team:** backend@tipbox.com
- **API Documentation:** https://docs.tipbox.com
- **Slack Channel:** #api-support

---

## Changelog

### Version 2.0 (2026-02-26)
- ✅ Added EP-01: List user badges with categories
- ✅ Added EP-03: Get badge detail with tasks
- ✅ Added EP-05: Get highlight badge selection data
- ✅ Added EP-06: Update highlight badges (max 4)
- ⚠️ Updated EP-07: Profile endpoint with new badge format
- ✅ Added LEGENDARY rarity tier
- ✅ Enum mapping: COMMON → Usual, BRAND → bridge
- ⚠️ Breaking: Profile now returns max 4 badges with extended fields

### Version 1.0 (Previous)
- Basic badge list endpoint
- Profile with 6 badges (old format)
