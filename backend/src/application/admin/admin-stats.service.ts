import { getPrisma } from '../../infrastructure/repositories/prisma.client';

export type AdminStats = {
  users: number;
  posts: number;
  bannedUsers: number;
  adminLogs: number;
};

/**
 * Admin panel için genel istatistikleri döndürür.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const prisma = getPrisma();

  const [users, posts, bannedUsers, adminLogs] = await Promise.all([
    prisma.user.count(),
    prisma.contentPost.count(),
    prisma.user.count({ where: { status: 'BANNED' } }),
    prisma.adminLog.count(),
  ]);

  return {
    users,
    posts,
    bannedUsers,
    adminLogs,
  };
}
