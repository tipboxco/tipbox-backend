# Admin Panel Navigation Structure

## 📊 Overview

The Tipbox Admin Panel features a hierarchical navigation system with 12 main menu items and 47 sub-pages, organized according to the backend domain structure.

## 🗂️ Navigation Hierarchy

### 1. 📊 **Dashboard** `/`
Main overview page with statistics, recent activity, and quick actions.

**Features:**
- Key metrics (users, events, transactions, revenue)
- Recent activity feed
- Quick action buttons
- System status indicators

---

### 2. 👥 **Users** (5 sub-pages)
User account management and moderation.

| Page | Path | Description |
|------|------|-------------|
| **User List** | `/users` | Browse and search all platform users |
| **KYC Verification** | `/users/kyc` | Review and approve KYC submissions |
| **Trust Scores** | `/users/trust-scores` | Monitor user trust and reputation |
| **User Reports** | `/users/reports` | Handle user-reported content |
| **Banned Users** | `/users/banned` | Manage banned/suspended accounts |

**Domain:** `backend/src/domain/user`

**Key Entities:** User, Profile, UserTrustScore, UserKYCRecord

---

### 3. 📝 **Content** (6 sub-pages)
User-generated content management and moderation.

| Page | Path | Description |
|------|------|-------------|
| **All Posts** | `/content/posts` | Manage all user posts (tips, comparisons, questions) |
| **Comments** | `/content/comments` | Moderate user comments |
| **Trending Posts** | `/content/trending` | View and curate trending content |
| **Moderation Queue** | `/content/moderation` | Review flagged content |
| **Manual Reviews** | `/content/reviews` | Content requiring manual review |
| **Tags & Categories** | `/content/tags` | Manage content taxonomy |

**Domain:** `backend/src/domain/content` + `backend/src/domain/interaction`

**Key Entities:** ContentPost, ContentComment, PostTag, TrendingPost

**Content Types:**
- FREE: Free-form posts
- TIPS: Tips and advice
- COMPARE: Product comparisons
- QUESTION: User questions
- EXPERIENCE: Product experiences
- UPDATE: Product updates

---

### 4. 🏪 **Products** (6 sub-pages)
Product catalog and inventory management.

| Page | Path | Description |
|------|------|-------------|
| **Product Catalog** | `/products` | Manage product database |
| **Categories** | `/products/categories` | Organize main/sub categories |
| **Product Groups** | `/products/groups` | Create product groupings |
| **Product Suggestions** | `/products/suggestions` | Review user-submitted products |
| **User Inventories** | `/products/inventories` | View user-owned products |
| **Comparisons** | `/products/comparisons` | Manage comparison posts |

**Domain:** `backend/src/domain/product` + `backend/src/domain/inventory`

**Key Entities:** Product, MainCategory, SubCategory, ProductGroup, Inventory

---

### 5. 🏢 **Brands** (5 sub-pages)
Brand partnerships and engagement (Bridge program).

| Page | Path | Description |
|------|------|-------------|
| **Brand List** | `/brands` | Manage brand partnerships |
| **Bridge Program** | `/brands/bridge` | Brand community engagement platform |
| **Brand Surveys** | `/brands/surveys` | Create and manage brand surveys |
| **Leaderboards** | `/brands/leaderboards` | Brand engagement rankings |
| **Rewards** | `/brands/rewards` | Brand reward distribution |

**Domain:** `backend/src/domain/brand`

**Key Entities:** Brand, BridgePost, BrandSurvey, BridgeLeaderboard, BridgeReward

**Survey Types:**
- TEXT: Open-ended questions
- MULTIPLE_CHOICE: Multi-option questions
- RATING: Rating scale questions

---

### 6. 🎮 **Gamification** (5 sub-pages)
Achievement and badge system management.

| Page | Path | Description |
|------|------|-------------|
| **Badges** | `/gamification/badges` | Create and manage badges |
| **Badge Collections** | `/gamification/collections` | Organize badges into collections |
| **Achievements** | `/gamification/achievements` | Define user achievements |
| **Achievement Chains** | `/gamification/chains` | Create progressive achievement paths |
| **User Progress** | `/gamification/progress` | Track user achievement progress |

**Domain:** `backend/src/domain/gamification`

**Key Entities:** Badge, BadgeCollection, AchievementChain, UserAchievement

**Badge Types:**
- COLLECTION: Badge collections
- EVENT: Event-specific badges
- COSMETIC: Visual customizations
- BRAND: Brand partnership badges

**Badge Rarity:** COMMON, RARE, EPIC

---

### 7. 🎯 **Events** (4 sub-pages)
Time-limited events and challenges.

| Page | Path | Description |
|------|------|-------------|
| **Event List** | `/events` | Manage platform events |
| **Event Badges** | `/events/badges` | Configure event-specific badges |
| **Event Rewards** | `/events/rewards` | Set up event rewards |
| **Event Analytics** | `/events/analytics` | View event performance metrics |

**Domain:** `backend/src/domain/event`

**Key Entities:** Event, EventBadge, EventReward, EventScenario

**Event Types:**
- SURVEY: Survey events
- POLL: Polling events
- CONTEST: Competitions
- CHALLENGE: User challenges
- PROMOTION: Promotional campaigns

---

### 8. 💰 **Commerce** (4 sub-pages)
Financial transactions and monetization.

| Page | Path | Description |
|------|------|-------------|
| **Transactions** | `/commerce/transactions` | View all platform transactions |
| **Rewards** | `/commerce/rewards` | Manage reward claims |
| **Subscriptions** | `/commerce/subscriptions` | User subscription management |
| **Invoices** | `/commerce/invoices` | Payment invoice tracking |

**Domains:**
- `backend/src/domain/transaction`
- `backend/src/domain/reward`
- `backend/src/domain/payment`

**Key Entities:** Transaction, RewardClaim, UserSubscription, Invoice

**Transaction Types:**
- TIP_SEND / TIP_RECEIVE
- NFT_BUY / NFT_SELL
- SWAP_TIP_TO_SOL / SWAP_SOL_TO_TIP
- CLAIM_REWARD / CLAIM_BADGE
- AIRDROP
- FEE

---

### 9. 💎 **Crypto** (5 sub-pages)
Blockchain, NFT, and wallet management.

| Page | Path | Description |
|------|------|-------------|
| **Wallets** | `/crypto/wallets` | Manage user crypto wallets |
| **NFTs** | `/crypto/nfts` | Manage platform NFT assets |
| **NFT Marketplace** | `/crypto/marketplace` | Monitor NFT marketplace |
| **Lootboxes** | `/crypto/lootboxes` | Manage lootbox system |
| **Token Transfers** | `/crypto/transfers` | View TIPS token transactions |

**Domains:**
- `backend/src/domain/crypto`
- `backend/src/domain/wallet`

**Key Entities:** Wallet, NFT, NFTMarketListing, Lootbox, TipsTokenTransfer

**Wallet Providers:**
- METAMASK
- WALLETCONNECT
- CUSTOM

**NFT Types:**
- BADGE: Badge-based NFTs
- COSMETIC: Cosmetic items
- LOOTBOX: Lootbox items

---

### 10. 💬 **Communication** (4 sub-pages)
Messaging and notification system.

| Page | Path | Description |
|------|------|-------------|
| **Notifications** | `/communication/notifications` | System notifications |
| **Direct Messages** | `/communication/messages` | User messaging system |
| **Support Requests** | `/communication/support` | User support tickets |
| **Expert Requests** | `/communication/experts` | Expert Q&A system |

**Domains:**
- `backend/src/domain/notification`
- `backend/src/domain/messaging`
- `backend/src/domain/expert`

**Key Entities:** Notification, DMThread, DMMessage, DMSupportSession, ExpertRequest

**Notification Categories:**
- Interactions (likes, comments, shares)
- Trust & Follow
- Messaging
- Gamification
- Events
- Transactions
- NFTs

---

### 11. 📈 **Analytics** `/analytics`
Comprehensive platform analytics and reporting.

**Features:**
- User analytics
- Content engagement metrics
- Revenue reports
- Event performance
- Platform growth metrics

---

### 12. ⚙️ **System** (3 sub-pages)
System administration and configuration.

| Page | Path | Description |
|------|------|-------------|
| **Admin Logs** | `/system/logs` | View admin action history |
| **Settings** | `/system/settings` | Configure system settings |
| **Moderation Actions** | `/system/moderation` | Review moderation history |

**Domain:** `backend/src/domain/admin`

**Key Entities:** AdminLog, ModerationAction, ManualReviewFlag

**Moderation Actions:**
- BAN: Ban user
- WARN: Issue warning
- MUTE: Mute user
- CONTENT_REMOVED: Remove content

---

## 🎨 Navigation Features

### Hierarchical Menu System
- **Parent Items**: Main categories with expandable submenus
- **Submenu Items**: Specific pages within each category
- **Active States**: Highlights both active page and parent category
- **Smooth Animations**: Expand/collapse with fade and slide effects

### Responsive Design
- **Desktop**: Full sidebar with expanded submenus
- **Tablet**: Collapsible sidebar
- **Mobile**: Hidden sidebar with overlay toggle

### Visual Indicators
- **Lime Accent** (#D0F205): Active items and highlights
- **Dot Indicators**: Submenu item markers
- **Chevron Icons**: Expand/collapse indicators
- **Left Border**: Active item indicator

## 📊 Statistics

- **Total Routes**: 47 pages
- **Main Menu Items**: 12
- **Submenus**: 10
- **Single Pages**: 2 (Dashboard, Analytics)
- **Deepest Hierarchy**: 2 levels (parent → child)

## 🔗 Domain Mapping

| Navigation Group | Backend Domains |
|-----------------|-----------------|
| Users | user, admin (partial) |
| Content | content, interaction, admin (moderation) |
| Products | product, inventory |
| Brands | brand |
| Gamification | gamification |
| Events | event |
| Commerce | transaction, reward, payment |
| Crypto | crypto, wallet |
| Communication | notification, messaging, expert |
| System | admin |

## 🚀 Future Enhancements

- [ ] Breadcrumb navigation
- [ ] Favorite/pin pages
- [ ] Recent pages history
- [ ] Keyboard shortcuts
- [ ] Search navigation
- [ ] Role-based menu visibility
- [ ] Notification badges on menu items
- [ ] Customizable menu order
