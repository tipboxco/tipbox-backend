import { z } from 'zod';

/**
 * Common pagination schema used across all admin endpoints
 */
export const AdminPaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type AdminPaginationQuery = z.infer<typeof AdminPaginationQuerySchema>;
