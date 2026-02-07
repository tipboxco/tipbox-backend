import { get } from './client';
import type { AdminLogListItem, PaginationMeta } from '../types/admin';

const prefix = '/admin';

/** GET /admin/logs — Admin işlem logları (sayfalı) */
export async function fetchAdminLogs(params?: { limit?: number; offset?: number }) {
  const query = params
    ? { limit: params.limit ?? 50, offset: params.offset ?? 0 }
    : undefined;
  return get<AdminLogListItem[]>(`${prefix}/logs`, query);
}
