import { z } from 'zod';
import { CommonSchemas } from '../../infrastructure/middleware/validation.middleware';

/**
 * Post type enum
 */
export const PostType = z.enum([
  'BENCHMARK',
  'POST',
  'QUESTION',
  'TIPS_AND_TRICKS',
  'EXPERIENCE',
  'UPDATE',
]);

/**
 * Context type enum
 */
export const ContextType = z.enum([
  'PRODUCT_GROUP',
  'PRODUCT',
  'SUB_CATEGORY',
  'MAIN_CATEGORY',
]);

/**
 * Create post schema
 */
export const CreatePostSchema = z.object({
  type: PostType,
  contextType: ContextType,
  contextId: CommonSchemas.id,
  content: z.string()
    .min(1, 'İçerik boş olamaz')
    .max(5000, 'İçerik en fazla 5000 karakter olabilir')
    .trim(),
  title: z.string()
    .max(200, 'Başlık en fazla 200 karakter olabilir')
    .trim()
    .optional(),
  images: z.array(z.string().url()).max(10).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export type CreatePostRequest = z.infer<typeof CreatePostSchema>;

/**
 * Get post params schema
 */
export const GetPostParamsSchema = z.object({
  id: CommonSchemas.id,
});

export type GetPostParams = z.infer<typeof GetPostParamsSchema>;

/**
 * Get posts query schema
 */
export const GetPostsQuerySchema = z.object({
  type: PostType.optional(),
  contextType: ContextType.optional(),
  contextId: CommonSchemas.id.optional(),
  userId: CommonSchemas.id.optional(),
  page: CommonSchemas.page,
  limit: CommonSchemas.limit,
  cursor: CommonSchemas.cursor,
});

export type GetPostsQuery = z.infer<typeof GetPostsQuerySchema>;

/**
 * Add comment schema
 */
export const AddCommentSchema = z.object({
  content: z.string()
    .min(1, 'Yorum boş olamaz')
    .max(1000, 'Yorum en fazla 1000 karakter olabilir')
    .trim(),
  parentCommentId: CommonSchemas.id.optional(),
});

export type AddCommentRequest = z.infer<typeof AddCommentSchema>;

/**
 * Like post params schema
 */
export const LikePostParamsSchema = z.object({
  postId: CommonSchemas.id,
});

export type LikePostParams = z.infer<typeof LikePostParamsSchema>;

