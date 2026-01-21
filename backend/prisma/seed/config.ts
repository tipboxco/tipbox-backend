export type SeedPhase =
  | 'system'
  | 'users'
  | 'ugc'
  | 'interactions'
  | 'derived'
  | 'all'

function asInt(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function asBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback
  const v = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false
  return fallback
}

function asSeedPhase(value: string | undefined, fallback: SeedPhase): SeedPhase {
  const v = (value || '').trim().toLowerCase()
  const allowed: SeedPhase[] = ['system', 'users', 'ugc', 'interactions', 'derived', 'all']
  return (allowed as string[]).includes(v) ? (v as SeedPhase) : fallback
}

export const seedConfig = {
  phase: asSeedPhase(process.env.SEED_PHASE, 'all'),

  users: {
    total: asInt(process.env.SEED_USERS_TOTAL, 20),
  },

  inventories: {
    featuredProductsMin: asInt(process.env.SEED_FEATURED_INVENTORY_MIN, 3),
    featuredProductsMax: asInt(process.env.SEED_FEATURED_INVENTORY_MAX, 8),
    otherProductsMin: asInt(process.env.SEED_OTHER_INVENTORY_MIN, 1),
    otherProductsMax: asInt(process.env.SEED_OTHER_INVENTORY_MAX, 1),
    mediaProbability: Math.min(
      1,
      Math.max(0, Number(process.env.SEED_INVENTORY_MEDIA_PROBABILITY ?? 0.6)),
    ),
  },

  posts: {
    total: asInt(process.env.SEED_POSTS_TOTAL, 100),
    featuredOnly: asBool(process.env.SEED_POSTS_FEATURED_ONLY, true),
    otherUsersPostsMin: asInt(process.env.SEED_OTHER_USERS_POSTS_MIN, 1),
    otherUsersPostsMax: asInt(process.env.SEED_OTHER_USERS_POSTS_MAX, 2),
    batchSize: asInt(process.env.SEED_AI_BATCH_SIZE, 2),
    batchDelayMs: asInt(process.env.SEED_AI_BATCH_DELAY_MS, 700),
  },

  tags: {
    perPostMin: asInt(process.env.SEED_TAGS_PER_POST_MIN, 1),
    perPostMax: asInt(process.env.SEED_TAGS_PER_POST_MAX, 3),
  },

  interactions: {
    enabled: asBool(process.env.SEED_INTERACTIONS_ENABLED, true),
    likesPerPostMin: asInt(process.env.SEED_LIKES_PER_POST_MIN, 0),
    likesPerPostMax: asInt(process.env.SEED_LIKES_PER_POST_MAX, 6),
    viewsPerPostMin: asInt(process.env.SEED_VIEWS_PER_POST_MIN, 0),
    viewsPerPostMax: asInt(process.env.SEED_VIEWS_PER_POST_MAX, 15),
    commentsPerPostMin: asInt(process.env.SEED_COMMENTS_PER_POST_MIN, 0),
    commentsPerPostMax: asInt(process.env.SEED_COMMENTS_PER_POST_MAX, 2),
    sharesPerPostMin: asInt(process.env.SEED_SHARES_PER_POST_MIN, 0),
    sharesPerPostMax: asInt(process.env.SEED_SHARES_PER_POST_MAX, 1),
    favoritesPerUserMin: asInt(process.env.SEED_FAVORITES_PER_USER_MIN, 1),
    favoritesPerUserMax: asInt(process.env.SEED_FAVORITES_PER_USER_MAX, 4),
  },

  trust: {
    enabled: asBool(process.env.SEED_TRUST_ENABLED, true),
    perUserMin: asInt(process.env.SEED_TRUST_PER_USER_MIN, 2),
    perUserMax: asInt(process.env.SEED_TRUST_PER_USER_MAX, 8),
  },

  events: {
    enabled: asBool(process.env.SEED_EVENTS_ENABLED, true),
    activeMax: asInt(process.env.SEED_ACTIVE_EVENTS_MAX, 5),
    createUgc: asBool(process.env.SEED_EVENTS_CREATE_UGC, true),
  },

  messaging: {
    enabled: asBool(process.env.SEED_MESSAGING_ENABLED, true),
    threadsMin: asInt(process.env.SEED_DM_THREADS_MIN, 10),
    threadsMax: asInt(process.env.SEED_DM_THREADS_MAX, 20),
    messagesPerThreadMin: asInt(process.env.SEED_DM_MESSAGES_PER_THREAD_MIN, 2),
    messagesPerThreadMax: asInt(process.env.SEED_DM_MESSAGES_PER_THREAD_MAX, 8),
    supportRequestsMin: asInt(process.env.SEED_DM_SUPPORT_REQUESTS_MIN, 5),
    supportRequestsMax: asInt(process.env.SEED_DM_SUPPORT_REQUESTS_MAX, 10),
  },

  nft: {
    enabled: asBool(process.env.SEED_NFT_ENABLED, true),
    perUserMin: asInt(process.env.SEED_NFTS_PER_USER_MIN, 0),
    perUserMax: asInt(process.env.SEED_NFTS_PER_USER_MAX, 2),
  },

  derived: {
    trendingEnabled: asBool(process.env.SEED_TRENDING_ENABLED, true),
    feedDistributionEnabled: asBool(process.env.SEED_FEED_DISTRIBUTION_ENABLED, true),
    achievementBackfillEnabled: asBool(process.env.SEED_ACHIEVEMENT_BACKFILL_ENABLED, true),
  },
} as const

