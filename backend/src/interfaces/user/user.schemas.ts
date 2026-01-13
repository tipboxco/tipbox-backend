import { z } from 'zod';
import { CommonSchemas } from '../../infrastructure/middleware/validation.middleware';

/**
 * Update profile schema
 */
export const UpdateProfileSchema = z.object({
  displayName: CommonSchemas.name.optional(),
  bio: CommonSchemas.bio,
  location: z.string().max(100).trim().optional(),
  website: CommonSchemas.url,
  dateOfBirth: z.string().datetime().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
});

export type UpdateProfileRequest = z.infer<typeof UpdateProfileSchema>;

/**
 * Update user settings schema
 */
export const UpdateSettingsSchema = z.object({
  language: z.enum(['TR', 'EN']).optional(),
  theme: z.enum(['LIGHT', 'DARK', 'AUTO']).optional(),
  notificationsEnabled: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
});

export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsSchema>;

/**
 * Update privacy settings schema
 */
export const UpdatePrivacySchema = z.object({
  profileVisibility: z.enum(['PUBLIC', 'PRIVATE', 'FRIENDS_ONLY']).optional(),
  showEmail: z.boolean().optional(),
  showPhone: z.boolean().optional(),
  allowMessages: z.boolean().optional(),
  allowComments: z.boolean().optional(),
});

export type UpdatePrivacyRequest = z.infer<typeof UpdatePrivacySchema>;

/**
 * Get user by ID params schema
 */
export const GetUserParamsSchema = z.object({
  id: CommonSchemas.id,
});

export type GetUserParams = z.infer<typeof GetUserParamsSchema>;

/**
 * Search users query schema
 */
export const SearchUsersQuerySchema = z.object({
  q: z.string().min(1).max(100),
  page: CommonSchemas.page,
  limit: CommonSchemas.limit,
});

export type SearchUsersQuery = z.infer<typeof SearchUsersQuerySchema>;

