import { Prisma } from '@prisma/client';

/**
 * Prisma Type Helpers
 * 
 * Bu helper'lar, Prisma'nın type system'inin bazı denormalized count field'larını
 * tanımaması durumunda type-safe çözümler sağlar.
 * 
 * NOT: Bu helper'lar runtime'da hiçbir overhead yaratmaz (sadece type assertion).
 * Prisma client generate edildiğinde ve type'lar düzeldiğinde bu helper'lar kaldırılabilir.
 */

/**
 * Helper type for Profile updateMany operations
 * Used to safely type count field updates that Prisma types may not include
 */
export function asProfileUpdateMany(
  data: {
    postsCount?: { increment: number } | { decrement: number } | number;
    trustCount?: { increment: number } | { decrement: number } | number;
    trusterCount?: { increment: number } | { decrement: number } | number;
    unseenFeedCount?: { increment: number } | { decrement: number } | number;
  }
): Prisma.ProfileUpdateManyMutationInput {
  // Convert number to set operation
  const converted = { ...data };
  if (typeof converted.trustCount === 'number') {
    converted.trustCount = converted.trustCount as unknown as { increment: number } | { decrement: number };
  }
  if (typeof converted.trusterCount === 'number') {
    converted.trusterCount = converted.trusterCount as unknown as { increment: number } | { decrement: number };
  }
  if (typeof converted.postsCount === 'number') {
    converted.postsCount = converted.postsCount as unknown as { increment: number } | { decrement: number };
  }
  if (typeof converted.unseenFeedCount === 'number') {
    converted.unseenFeedCount = converted.unseenFeedCount as unknown as { increment: number } | { decrement: number };
  }
  return converted as unknown as Prisma.ProfileUpdateManyMutationInput;
}

/**
 * Helper type for ContentPost update operations
 */
export function asContentPostUpdate(
  data: {
    likesCount?: { increment: number } | { decrement: number };
    commentsCount?: { increment: number } | { decrement: number };
    favoritesCount?: { increment: number } | { decrement: number };
    viewsCount?: { increment: number } | { decrement: number };
    sharesCount?: { increment: number } | { decrement: number };
  }
): Prisma.ContentPostUpdateInput {
  return data as unknown as Prisma.ContentPostUpdateInput;
}

/**
 * Helper type for ContentPost updateMany operations
 */
export function asContentPostUpdateMany(
  data: {
    likesCount?: { increment: number } | { decrement: number };
    commentsCount?: { increment: number } | { decrement: number };
    favoritesCount?: { increment: number } | { decrement: number };
    viewsCount?: { increment: number } | { decrement: number };
    sharesCount?: { increment: number } | { decrement: number };
  }
): Prisma.ContentPostUpdateManyMutationInput {
  return data as unknown as Prisma.ContentPostUpdateManyMutationInput;
}

/**
 * Helper type for ContentPost orderBy operations
 */
export function asContentPostOrderBy(
  data: {
    likesCount?: 'asc' | 'desc';
    commentsCount?: 'asc' | 'desc';
    favoritesCount?: 'asc' | 'desc';
    viewsCount?: 'asc' | 'desc';
    sharesCount?: 'asc' | 'desc';
  }
): Prisma.ContentPostOrderByWithRelationInput {
  return data as unknown as Prisma.ContentPostOrderByWithRelationInput;
}

/**
 * Helper type for ContentPost select operations
 */
export function asContentPostSelect(
  fields: {
    likesCount?: boolean;
    commentsCount?: boolean;
    favoritesCount?: boolean;
    viewsCount?: boolean;
    sharesCount?: boolean;
  }
): Prisma.ContentPostSelect {
  return fields as unknown as Prisma.ContentPostSelect;
}

/**
 * Helper type for ContentComment update operations
 */
export function asContentCommentUpdate(
  data: {
    likesCount?: { increment: number } | { decrement: number };
  }
): Prisma.ContentCommentUpdateInput {
  return data as unknown as Prisma.ContentCommentUpdateInput;
}

/**
 * Helper type for DMThread update operations
 */
export function asDMThreadUpdate(
  data: {
    unreadCountUserOne?: number | { increment: number } | { decrement: number };
    unreadCountUserTwo?: number | { increment: number } | { decrement: number };
  }
): Prisma.DMThreadUpdateInput {
  return data as unknown as Prisma.DMThreadUpdateInput;
}

/**
 * Helper type for Profile select operations
 */
export function asProfileSelect(
  fields: {
    unseenFeedCount?: boolean;
    postsCount?: boolean;
    trustCount?: boolean;
    trusterCount?: boolean;
  }
): Prisma.ProfileSelect {
  return fields as unknown as Prisma.ProfileSelect;
}

/**
 * Helper type for Prisma where clauses with dynamic conditions
 * Use this when building complex where clauses that TypeScript can't infer
 */
export function asPrismaWhere<T extends Prisma.JsonValue>(
  where: T
): T {
  return where;
}

/**
 * Helper for Profile where clauses
 */
export function asProfileWhere(
  where: {
    userId?: { in: string[] } | string;
    displayName?: { contains: string; mode: 'insensitive' };
    userName?: { contains: string; mode: 'insensitive' };
    OR?: Array<{
      displayName?: { contains: string; mode: 'insensitive' };
      userName?: { contains: string; mode: 'insensitive' };
    }>;
  }
): Prisma.ProfileWhereInput {
  return where as unknown as Prisma.ProfileWhereInput;
}

/**
 * Helper for Profile select with custom fields
 */
export function asProfileSelectWithFields(
  fields: {
    userId?: boolean;
    displayName?: boolean;
    userName?: boolean;
    cosmeticBadgeId?: boolean;
    [key: string]: boolean | undefined;
  }
): Prisma.ProfileSelect {
  return fields as unknown as Prisma.ProfileSelect;
}

/**
 * Helper for Profile update with cosmeticBadgeId
 */
export function asProfileUpdate(
  data: {
    displayName?: string | null;
    userName?: string | null;
    bio?: string | null;
    bannerUrl?: string | null;
    cosmeticBadgeId?: string | null | undefined;
  }
): Prisma.ProfileUpdateInput {
  return data as unknown as Prisma.ProfileUpdateInput;
}

/**
 * Helper for accessing Prisma models that may not be in generated types
 * Use this for models like UserBlock, UserMute that exist in schema but may not be in types
 */
export function getPrismaModel<T = unknown>(
  prisma: ReturnType<typeof import('./prisma.client').getPrisma>,
  modelName: string
): T {
  return (prisma as unknown as { [key: string]: T })[modelName] as T;
}

/**
 * Type guard for checking if an object has count fields
 */
export function hasCountFields(
  obj: unknown
): obj is { likesCount?: number; commentsCount?: number; favoritesCount?: number; viewsCount?: number; sharesCount?: number } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ('likesCount' in obj || 'commentsCount' in obj || 'favoritesCount' in obj || 'viewsCount' in obj || 'sharesCount' in obj)
  );
}

/**
 * Safely extract count fields from a post object
 */
export function getPostCounts(post: unknown): {
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  favoritesCount: number;
  viewsCount: number;
} {
  if (!hasCountFields(post)) {
    return {
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      favoritesCount: 0,
      viewsCount: 0,
    };
  }

  return {
    likesCount: typeof post.likesCount === 'number' ? post.likesCount : 0,
    commentsCount: typeof post.commentsCount === 'number' ? post.commentsCount : 0,
    sharesCount: typeof post.sharesCount === 'number' ? post.sharesCount : 0,
    favoritesCount: typeof post.favoritesCount === 'number' ? post.favoritesCount : 0,
    viewsCount: typeof post.viewsCount === 'number' ? post.viewsCount : 0,
  };
}

