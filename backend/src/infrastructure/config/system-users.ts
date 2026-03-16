/**
 * Prisma where clause to exclude system users from public-facing queries.
 *
 * Usage:
 *   prisma.user.findMany({ where: { ...NOT_SYSTEM_USER, status: 'ACTIVE' } })
 *
 * For relation filters (e.g. inside include/where on related models):
 *   where: { user: NOT_SYSTEM_USER }
 */
export const NOT_SYSTEM_USER = { isSystemUser: false } as const;
