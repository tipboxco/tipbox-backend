import { z } from 'zod';

export const CollectionsListQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  mainCategoryId: z.string().optional(),
  subCategoryId: z.string().optional(),
  productGroupId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return 20;
      const num = Number(val);
      if (Number.isNaN(num) || num < 1) return 20;
      return Math.min(num, 50);
    }),
});

export type CollectionsListQuery = z.infer<typeof CollectionsListQuerySchema>;

export const CollectionDetailQuerySchema = z.object({
  search: z.string().optional(),
});

export type CollectionDetailQuery = z.infer<typeof CollectionDetailQuerySchema>;
