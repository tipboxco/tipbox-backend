import { z } from 'zod';
import { AdminPaginationQuerySchema } from './admin-common.schemas';

/* ========== Users Management ========== */

export const AdminUpdateUserSchema = z.object({
  email: z.string().email().optional(),
  status: z.string().nullable().optional(),
  emailVerified: z.boolean().optional(),
});

export const AdminPutRolesSchema = z.object({
  roles: z.array(z.string().min(1)).min(0),
});

export const AdminResolveReportSchema = z.object({
  resolved: z.boolean(),
  adminNote: z.string().max(500).optional(),
});

const KycReviewStatusEnum = z.enum(['INIT', 'PENDING', 'COMPLETED', 'DECLINED', 'ON_HOLD']);
const KycReviewResultEnum = z.enum(['NULL', 'GREEN', 'YELLOW', 'RED']);

export const AdminKycReviewSchema = z.object({
  reviewStatus: KycReviewStatusEnum.optional(),
  reviewResult: KycReviewResultEnum.optional(),
  reviewReason: z.string().max(500).optional(),
});

export const AdminUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().min(1).optional(),
  status: z.string().optional(),
  emailVerified: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  sort: z.enum(['createdAt', 'email']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminUserReportsQuerySchema = AdminPaginationQuerySchema.extend({
  reportedUserId: z.string().uuid().optional(),
  reporterId: z.string().uuid().optional(),
  category: z.string().optional(),
  sort: z.enum(['createdAt', 'category']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminUserKycQuerySchema = AdminPaginationQuerySchema.extend({
  userId: z.string().uuid().optional(),
  reviewStatus: KycReviewStatusEnum.optional(),
  reviewResult: KycReviewResultEnum.optional(),
});

export const AdminUserTrustScoresQuerySchema = AdminPaginationQuerySchema.extend({
  userId: z.string().uuid().optional(),
  sort: z.enum(['calculatedAt', 'score', 'createdAt']).default('calculatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const AdminLoginAttemptsQuerySchema = AdminPaginationQuerySchema.extend({
  status: z.enum(['SUCCESS', 'FAILED', 'LOCKED']).optional(),
});

/** Avatar: create (new imageUrl) */
export const AdminAvatarCreateSchema = z.object({
  imageUrl: z.string().url().min(1),
});

/** Avatar: update (set active or change imageUrl) */
export const AdminAvatarUpdateSchema = z.object({
  imageUrl: z.string().url().optional(),
  avatarId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

/** Grant badge to user */
export const AdminGrantBadgeSchema = z.object({
  badgeId: z.string().uuid(),
  isVisible: z.boolean().optional().default(true),
  displayOrder: z.number().int().optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'TRUSTERS', 'PRIVATE']).optional().default('PUBLIC'),
});

/* ========== Type Exports ========== */

export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserSchema>;
export type AdminPutRolesInput = z.infer<typeof AdminPutRolesSchema>;
export type AdminResolveReportInput = z.infer<typeof AdminResolveReportSchema>;
export type AdminKycReviewInput = z.infer<typeof AdminKycReviewSchema>;
export type AdminUsersQuery = z.infer<typeof AdminUsersQuerySchema>;
export type AdminUserReportsQuery = z.infer<typeof AdminUserReportsQuerySchema>;
export type AdminUserKycQuery = z.infer<typeof AdminUserKycQuerySchema>;
export type AdminUserTrustScoresQuery = z.infer<typeof AdminUserTrustScoresQuerySchema>;
export type AdminLoginAttemptsQuery = z.infer<typeof AdminLoginAttemptsQuerySchema>;
export type AdminAvatarCreateInput = z.infer<typeof AdminAvatarCreateSchema>;
export type AdminAvatarUpdateInput = z.infer<typeof AdminAvatarUpdateSchema>;
export type AdminGrantBadgeInput = z.infer<typeof AdminGrantBadgeSchema>;
