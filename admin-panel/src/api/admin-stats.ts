import { get } from './client';
import type { AdminStatsResponse } from '../types/admin';

const prefix = '/admin';

/** GET /admin/stats — Genel istatistikler (users, posts, bannedUsers, adminLogs) */
export async function fetchAdminStats() {
  return get<AdminStatsResponse>(`${prefix}/stats`);
}
