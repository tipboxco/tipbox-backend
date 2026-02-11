/* ========== Products ========== */

export type AdminProductStatsResponse = {
  total: number;
  addedThisMonth: number;
  byCategory: Record<string, number>;
  topByInventory: {
    productId: string;
    productName: string;
    inventoryCount: number;
  }[];
};

export type AdminProductListItem = {
  id: string;
  name: string;
  subName: string | null;
  description: string | null;
  groupId: string | null;
  groupName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  brandId: string | null;
  imageUrl: string | null;
  thumbnail: string | null;
  inventoryCount: number;
  postCount: number;
  createdAt: string;
};

export type AdminProductDetailResponse = AdminProductListItem & {
  updatedAt: string;
  metadata: Record<string, unknown> | null;
  recentInventories: {
    userId: string;
    username: string | null;
    createdAt: string;
  }[];
  recentPosts: {
    id: string;
    userId: string;
    username: string | null;
    createdAt: string;
  }[];
};

/* ========== Categories ========== */

export type AdminCategoryListItem = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  thumbnail: string | null;
  handle: string | null;
  rank: number | null;
  isActive: boolean | null;
  level: number | null;
  productCount: number;
  children: AdminCategoryListItem[];
};

export type AdminCategoryDetailResponse = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  thumbnail: string | null;
  handle: string | null;
  rank: number | null;
  isActive: boolean | null;
  metadata: Record<string, unknown> | null;
  productCount: number;
  children: AdminCategoryListItem[];
};

/* ========== Product Groups ========== */

export type AdminProductGroupStatsResponse = {
  total: number;
};

export type AdminProductGroupListItem = {
  id: string;
  name: string;
  description: string | null;
  subCategoryId: string;
  subCategoryName: string | null;
  imageUrl: string | null;
  productCount: number;
};

export type AdminProductGroupDetailResponse = AdminProductGroupListItem & {
  products: {
    id: string;
    name: string;
    imageUrl: string | null;
  }[];
};

/* ========== Product Suggestions ========== */

export type AdminProductSuggestionStatsResponse = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  approvedThisMonth: number;
  topSuggesters: {
    userId: string;
    username: string | null;
    suggestionCount: number;
  }[];
};

export type AdminProductSuggestionListItem = {
  id: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  suggestedName: string;
  suggestedBrand: string | null;
  description: string | null;
  reason: string | null;
  status: string; // PENDING | APPROVED | REJECTED
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminProductSuggestionDetailResponse = AdminProductSuggestionListItem & {
  updatedAt: string;
  user: {
    id: string;
    email: string | null;
    username: string | null;
  };
};

/* ========== User Inventories ========== */

export type AdminInventoryStatsResponse = {
  total: number;
  uniqueUsers: number;
  uniqueProducts: number;
};

export type AdminInventoryListItem = {
  id: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  productId: string;
  productName: string;
  experienceSummary: string | null;
  hasMedia: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminInventoryDetailResponse = AdminInventoryListItem & {
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
  media: {
    id: string;
    mediaUrl: string;
    uploadedAt: string;
  }[];
};

/* ========== Product Analytics ========== */

export type AdminProductAnalyticsResponse = {
  topProductsByPosts: {
    productId: string;
    productName: string;
    postCount: number;
  }[];
  topProductsByUsers: {
    productId: string;
    productName: string;
    userCount: number;
  }[];
  categoryDistribution: {
    categoryId: string;
    categoryName: string;
    productCount: number;
  }[];
};

/* ========== Input Types (inferred from schemas) ========== */

import type {
  AdminCreateProductSchema,
  AdminUpdateProductSchema,
  AdminMergeProductsSchema,
  AdminCreateCategorySchema,
  AdminUpdateCategorySchema,
  AdminCreateProductGroupSchema,
  AdminUpdateProductGroupSchema,
  AdminApproveSuggestionSchema,
  AdminRejectSuggestionSchema,
} from '../schemas/admin-products.schemas';
import type { z } from 'zod';

export type AdminCreateProductInput = z.infer<typeof AdminCreateProductSchema>;
export type AdminUpdateProductInput = z.infer<typeof AdminUpdateProductSchema>;
export type AdminMergeProductsInput = z.infer<typeof AdminMergeProductsSchema>;
export type AdminCreateCategoryInput = z.infer<typeof AdminCreateCategorySchema>;
export type AdminUpdateCategoryInput = z.infer<typeof AdminUpdateCategorySchema>;
export type AdminCreateProductGroupInput = z.infer<typeof AdminCreateProductGroupSchema>;
export type AdminUpdateProductGroupInput = z.infer<typeof AdminUpdateProductGroupSchema>;
export type AdminApproveSuggestionInput = z.infer<typeof AdminApproveSuggestionSchema>;
export type AdminRejectSuggestionInput = z.infer<typeof AdminRejectSuggestionSchema>;
