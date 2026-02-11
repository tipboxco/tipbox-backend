import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError, ValidationError } from '../../../infrastructure/errors/custom-errors';
import logger from '../../../infrastructure/logger/logger';

// Import schemas
import {
  AdminProductsQuerySchema,
  AdminCreateProductSchema,
  AdminUpdateProductSchema,
  AdminMergeProductsSchema,
  AdminCategoriesQuerySchema,
  AdminCreateCategorySchema,
  AdminUpdateCategorySchema,
  AdminReorderCategorySchema,
  AdminProductGroupsQuerySchema,
  AdminCreateProductGroupSchema,
  AdminUpdateProductGroupSchema,
  AdminProductSuggestionsQuerySchema,
  AdminApproveSuggestionSchema,
  AdminRejectSuggestionSchema,
  AdminInventoriesQuerySchema,
} from '../schemas/admin-products.schemas';

// Import DTOs
import type {
  AdminProductStatsResponse,
  AdminProductListItem,
  AdminProductDetailResponse,
  AdminCategoryListItem,
  AdminCategoryDetailResponse,
  AdminProductGroupStatsResponse,
  AdminProductGroupListItem,
  AdminProductGroupDetailResponse,
  AdminProductSuggestionStatsResponse,
  AdminProductSuggestionListItem,
  AdminProductSuggestionDetailResponse,
  AdminInventoryStatsResponse,
  AdminInventoryListItem,
  AdminInventoryDetailResponse,
  AdminProductAnalyticsResponse,
  AdminCreateProductInput,
  AdminUpdateProductInput,
  AdminMergeProductsInput,
  AdminCreateCategoryInput,
  AdminUpdateCategoryInput,
  AdminCreateProductGroupInput,
  AdminUpdateProductGroupInput,
  AdminApproveSuggestionInput,
  AdminRejectSuggestionInput,
} from '../dtos/admin-products.dto';

import type { PaginationMeta } from '../dtos/admin-common.dto';

const router = Router();
const prisma = getPrisma();

/**
 * Products & Catalog Router
 * Routes are mounted at /admin/products
 * All routes require authMiddleware and requireAdmin (applied at mount point)
 */

// ==================== Products ====================

/**
 * GET /admin/products/stats
 * Get products statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const total = await prisma.product.count();

    // Products added this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const addedThisMonth = await prisma.product.count({
      where: { createdAt: { gte: startOfMonth } },
    });

    // By category (top 10)
    const byCategory: Record<string, number> = {};
    const products = await prisma.product.findMany({
      where: { categoryId: { not: null } },
      select: { categoryId: true },
    });
    products.forEach((p) => {
      if (p.categoryId) {
        byCategory[p.categoryId] = (byCategory[p.categoryId] || 0) + 1;
      }
    });

    // Top products by inventory count
    const topByInventoryRaw = await prisma.inventory.groupBy({
      by: ['productId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const topByInventory = await Promise.all(
      topByInventoryRaw.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true },
        });
        return {
          productId: item.productId,
          productName: product?.name || 'Unknown',
          inventoryCount: item._count.id,
        };
      })
    );

    const data: AdminProductStatsResponse = {
      total,
      addedThisMonth,
      byCategory,
      topByInventory,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/products
 * List products with pagination and filters
 */
router.get(
  '/',
  validateQuery(AdminProductsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      search?: string;
      categoryId?: string;
      groupId?: string;
      brandId?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.groupId) where.groupId = q.groupId;
    if (q.brandId) where.brandId = q.brandId;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          _count: {
            select: { inventories: true, contentPosts: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Fetch group and category names
    const data: AdminProductListItem[] = await Promise.all(
      products.map(async (product) => {
        let groupName: string | null = null;
        let categoryName: string | null = null;

        if (product.groupId) {
          const group = await prisma.productGroup.findUnique({
            where: { id: product.groupId },
            select: { name: true },
          });
          groupName = group?.name || null;
        }

        if (product.categoryId) {
          const category = await prisma.category.findUnique({
            where: { id: product.categoryId },
            select: { name: true },
          });
          categoryName = category?.name || null;
        }

        return {
          id: product.id,
          name: product.name,
          subName: product.subName,
          description: product.description,
          groupId: product.groupId,
          groupName,
          categoryId: product.categoryId,
          categoryName,
          brandId: product.brandId,
          imageUrl: product.imageUrl,
          thumbnail: product.thumbnail,
          inventoryCount: product._count.inventories,
          postCount: product._count.contentPosts,
          createdAt: product.createdAt.toISOString(),
        };
      })
    );

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/products/:id
 * Get product details
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: { inventories: true, contentPosts: true },
        },
        inventories: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                profile: { select: { userName: true } },
              },
            },
          },
        },
        contentPosts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                profile: { select: { userName: true } },
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    let groupName: string | null = null;
    let categoryName: string | null = null;

    if (product.groupId) {
      const group = await prisma.productGroup.findUnique({
        where: { id: product.groupId },
        select: { name: true },
      });
      groupName = group?.name || null;
    }

    if (product.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: product.categoryId },
        select: { name: true },
      });
      categoryName = category?.name || null;
    }

    const data: AdminProductDetailResponse = {
      id: product.id,
      name: product.name,
      subName: product.subName,
      description: product.description,
      groupId: product.groupId,
      groupName,
      categoryId: product.categoryId,
      categoryName,
      brandId: product.brandId,
      imageUrl: product.imageUrl,
      thumbnail: product.thumbnail,
      inventoryCount: product._count.inventories,
      postCount: product._count.contentPosts,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      metadata: product.metadata as Record<string, unknown> | null,
      recentInventories: product.inventories.map((inv) => ({
        userId: inv.userId,
        username: inv.user.profile?.userName || null,
        createdAt: inv.createdAt.toISOString(),
      })),
      recentPosts: product.contentPosts.map((post) => ({
        id: post.id,
        userId: post.userId,
        username: post.user.profile?.userName || null,
        createdAt: post.createdAt.toISOString(),
      })),
    };

    return res.json({ success: true, data });
  })
);

/**
 * POST /admin/products
 * Create new product
 */
router.post(
  '/',
  validateBody(AdminCreateProductSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const body = req.body as AdminCreateProductInput;

    const productData = {
      id: body.id,
      name: body.name,
      description: body.description ?? null,
      subName: body.subName ?? null,
      groupId: body.groupId ?? null,
      categoryId: body.categoryId ?? null,
      brandId: body.brandId ?? null,
      imageUrl: body.imageUrl ?? null,
      thumbnail: body.thumbnail ?? null,
    };

    if (body.metadata) {
      Object.assign(productData, { metadata: body.metadata });
    }

    const product = await prisma.product.create({
      data: productData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'PRODUCT_CREATE',
        description: `productId: ${product.id}, name: ${product.name}`,
        entityType: 'product',
        entityId: 0,
      },
    });

    logger.info('Product created', { productId: product.id, adminId });

    return res.status(201).json({ success: true, data: product });
  })
);

/**
 * PATCH /admin/products/:id
 * Update product
 */
router.patch(
  '/:id',
  validateBody(AdminUpdateProductSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminUpdateProductInput;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    const updateData: Record<string, unknown> = { ...body };
    if (body.metadata) {
      updateData.metadata = body.metadata as Record<string, unknown>;
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'PRODUCT_UPDATE',
        description: `productId: ${product.id}, name: ${product.name}`,
        entityType: 'product',
        entityId: 0,
      },
    });

    logger.info('Product updated', { productId: product.id, adminId });

    return res.json({ success: true, data: product });
  })
);

/**
 * DELETE /admin/products/:id
 * Delete product
 */
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    // Check if product has inventories or posts
    const [inventoryCount, postCount] = await Promise.all([
      prisma.inventory.count({ where: { productId: id } }),
      prisma.contentPost.count({ where: { productId: id } }),
    ]);

    if (inventoryCount > 0 || postCount > 0) {
      throw new ValidationError(
        `Cannot delete product with ${inventoryCount} inventories and ${postCount} posts. Consider merging instead.`
      );
    }

    await prisma.product.delete({ where: { id } });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'PRODUCT_DELETE',
        description: `productId: ${id}, name: ${existing.name}`,
        entityType: 'product',
        entityId: 0,
      },
    });

    logger.info('Product deleted', { productId: id, adminId });

    return res.json({ success: true, message: 'Product deleted' });
  })
);

/**
 * POST /admin/products/merge
 * Merge two products (move all data from source to target, delete source)
 */
router.post(
  '/merge',
  validateBody(AdminMergeProductsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { sourceProductId, targetProductId } = req.body as AdminMergeProductsInput;

    const [source, target] = await Promise.all([
      prisma.product.findUnique({ where: { id: sourceProductId } }),
      prisma.product.findUnique({ where: { id: targetProductId } }),
    ]);

    if (!source) throw new NotFoundError(`Source product not found: ${sourceProductId}`);
    if (!target) throw new NotFoundError(`Target product not found: ${targetProductId}`);

    // Merge in transaction
    await prisma.$transaction(async (tx) => {
      // Update inventories
      await tx.inventory.updateMany({
        where: { productId: sourceProductId },
        data: { productId: targetProductId },
      });

      // Update content posts
      await tx.contentPost.updateMany({
        where: { productId: sourceProductId },
        data: { productId: targetProductId },
      });

      // Delete source product
      await tx.product.delete({ where: { id: sourceProductId } });
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'PRODUCT_MERGE',
        description: `source: ${sourceProductId} (${source.name}) → target: ${targetProductId} (${target.name})`,
        entityType: 'product',
        entityId: 0,
      },
    });

    logger.info('Products merged', {
      sourceProductId,
      targetProductId,
      adminId,
    });

    return res.json({
      success: true,
      message: `Product "${source.name}" merged into "${target.name}"`,
    });
  })
);

/**
 * GET /admin/products/analytics
 * Get product analytics
 */
router.get(
  '/analytics',
  asyncHandler(async (req: Request, res: Response) => {
    // Top products by posts
    const topByPostsRaw = await prisma.contentPost.groupBy({
      by: ['productId'],
      _count: { id: true },
      where: { productId: { not: null } },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const topProductsByPosts = await Promise.all(
      topByPostsRaw.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId! },
          select: { id: true, name: true },
        });
        return {
          productId: item.productId!,
          productName: product?.name || 'Unknown',
          postCount: item._count.id,
        };
      })
    );

    // Top products by unique users (inventory owners)
    const topByUsersRaw = await prisma.inventory.groupBy({
      by: ['productId'],
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    });

    const topProductsByUsers = await Promise.all(
      topByUsersRaw.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true },
        });
        return {
          productId: item.productId,
          productName: product?.name || 'Unknown',
          userCount: item._count.userId,
        };
      })
    );

    // Category distribution
    const categoryDistRaw = await prisma.product.groupBy({
      by: ['categoryId'],
      _count: { id: true },
      where: { categoryId: { not: null } },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const categoryDistribution = await Promise.all(
      categoryDistRaw.map(async (item) => {
        const category = await prisma.category.findUnique({
          where: { id: item.categoryId! },
          select: { id: true, name: true },
        });
        return {
          categoryId: item.categoryId!,
          categoryName: category?.name || 'Unknown',
          productCount: item._count.id,
        };
      })
    );

    const data: AdminProductAnalyticsResponse = {
      topProductsByPosts,
      topProductsByUsers,
      categoryDistribution,
    };

    return res.json({ success: true, data });
  })
);

// ==================== Categories ====================

/**
 * GET /admin/products/categories
 * Get hierarchical category list
 */
router.get(
  '/categories',
  validateQuery(AdminCategoriesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      parentId?: string;
      isActive?: boolean;
      search?: string;
    };

    const where: Record<string, unknown> = {};
    if (q.parentId !== undefined) where.parentId = q.parentId;
    if (q.isActive !== undefined) where.isActive = q.isActive;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: { rank: 'asc' },
      include: {
        _count: {
          select: { products: true, children: true },
        },
        children: {
          orderBy: { rank: 'asc' },
          include: {
            _count: { select: { products: true, children: true } },
          },
        },
      },
    });

    type CategoryWithChildren = (typeof categories)[0];

    const buildCategoryTree = (cat: CategoryWithChildren): AdminCategoryListItem => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      parentId: cat.parentId,
      thumbnail: cat.thumbnail,
      handle: cat.handle,
      rank: cat.rank,
      isActive: cat.isActive,
      level: cat.level,
      productCount: cat._count.products,
      children: cat.children.map(
        (child) => buildCategoryTree(child as unknown as CategoryWithChildren)
      ),
    });

    const data: AdminCategoryListItem[] = categories.map(buildCategoryTree);

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/products/categories/:id
 * Get category details
 */
router.get(
  '/categories/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true, children: true } },
        children: {
          orderBy: { rank: 'asc' },
          include: {
            _count: { select: { products: true } },
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const data: AdminCategoryDetailResponse = {
      id: category.id,
      name: category.name,
      description: category.description,
      parentId: category.parentId,
      thumbnail: category.thumbnail,
      handle: category.handle,
      rank: category.rank,
      isActive: category.isActive,
      metadata: category.metadata as Record<string, unknown> | null,
      productCount: category._count.products,
      children: category.children.map((child) => ({
        id: child.id,
        name: child.name,
        description: child.description,
        parentId: child.parentId,
        thumbnail: child.thumbnail,
        handle: child.handle,
        rank: child.rank,
        isActive: child.isActive,
        level: child.level,
        productCount: child._count.products,
        children: [],
      })),
    };

    return res.json({ success: true, data });
  })
);

/**
 * POST /admin/products/categories
 * Create category
 */
router.post(
  '/categories',
  validateBody(AdminCreateCategorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const body = req.body as AdminCreateCategoryInput;

    const categoryData = {
      id: body.id,
      name: body.name,
      description: body.description ?? null,
      parentId: body.parentId ?? null,
      thumbnail: body.thumbnail ?? null,
      handle: body.handle ?? null,
      rank: body.rank ?? null,
      isActive: body.isActive ?? true,
    };

    if (body.metadata) {
      Object.assign(categoryData, { metadata: body.metadata });
    }

    const category = await prisma.category.create({
      data: categoryData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'CATEGORY_CREATE',
        description: `categoryId: ${category.id}, name: ${category.name}`,
        entityType: 'category',
        entityId: 0,
      },
    });

    logger.info('Category created', { categoryId: category.id, adminId });

    return res.status(201).json({ success: true, data: category });
  })
);

/**
 * PATCH /admin/products/categories/:id
 * Update category
 */
router.patch(
  '/categories/:id',
  validateBody(AdminUpdateCategorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminUpdateCategoryInput;

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Category not found');
    }

    const updateData: Record<string, unknown> = { ...body };
    if (body.metadata) {
      updateData.metadata = body.metadata as Record<string, unknown>;
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'CATEGORY_UPDATE',
        description: `categoryId: ${category.id}, name: ${category.name}`,
        entityType: 'category',
        entityId: 0,
      },
    });

    logger.info('Category updated', { categoryId: category.id, adminId });

    return res.json({ success: true, data: category });
  })
);

/**
 * DELETE /admin/products/categories/:id
 * Delete category
 */
router.delete(
  '/categories/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;

    const existing = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true, children: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError('Category not found');
    }

    if (existing._count.products > 0 || existing._count.children > 0) {
      throw new ValidationError(
        `Cannot delete category with ${existing._count.products} products and ${existing._count.children} subcategories`
      );
    }

    await prisma.category.delete({ where: { id } });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'CATEGORY_DELETE',
        description: `categoryId: ${id}, name: ${existing.name}`,
        entityType: 'category',
        entityId: 0,
      },
    });

    logger.info('Category deleted', { categoryId: id, adminId });

    return res.json({ success: true, message: 'Category deleted' });
  })
);

/**
 * PUT /admin/products/categories/:id/reorder
 * Reorder category
 */
router.put(
  '/categories/:id/reorder',
  validateBody(AdminReorderCategorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const { rank } = req.body as { rank: number };

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Category not found');
    }

    const category = await prisma.category.update({
      where: { id },
      data: { rank },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'CATEGORY_REORDER',
        description: `categoryId: ${id}, name: ${existing.name}, newRank: ${rank}`,
        entityType: 'category',
        entityId: 0,
      },
    });

    logger.info('Category reordered', { categoryId: id, rank, adminId });

    return res.json({ success: true, data: category });
  })
);

// ==================== Product Groups ====================

/**
 * GET /admin/products/groups/stats
 * Get product groups statistics
 */
router.get(
  '/groups/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const total = await prisma.productGroup.count();

    const data: AdminProductGroupStatsResponse = {
      total,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/products/groups
 * List product groups with pagination and filters
 */
router.get(
  '/groups',
  validateQuery(AdminProductGroupsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      search?: string;
      subCategoryId?: string;
    };

    const where: Record<string, unknown> = {};
    if (q.subCategoryId) where.subCategoryId = q.subCategoryId;
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [groups, total] = await Promise.all([
      prisma.productGroup.findMany({
        where,
        orderBy: { name: 'asc' },
        take: q.limit,
        skip: q.offset,
        include: {
          _count: {
            select: { products: true },
          },
        },
      }),
      prisma.productGroup.count({ where }),
    ]);

    const data: AdminProductGroupListItem[] = await Promise.all(
      groups.map(async (group) => {
        let subCategoryName: string | null = null;

        if (group.subCategoryId) {
          const subCategory = await prisma.subCategory.findUnique({
            where: { id: group.subCategoryId },
            select: { name: true },
          });
          subCategoryName = subCategory?.name || null;
        }

        return {
          id: group.id,
          name: group.name,
          description: group.description,
          subCategoryId: group.subCategoryId,
          subCategoryName,
          imageUrl: group.imageUrl,
          productCount: group._count.products,
        };
      })
    );

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/products/groups/:id
 * Get product group details
 */
router.get(
  '/groups/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const group = await prisma.productGroup.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
        products: {
          take: 50,
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundError('Product group not found');
    }

    let subCategoryName: string | null = null;

    if (group.subCategoryId) {
      const subCategory = await prisma.subCategory.findUnique({
        where: { id: group.subCategoryId },
        select: { name: true },
      });
      subCategoryName = subCategory?.name || null;
    }

    const data: AdminProductGroupDetailResponse = {
      id: group.id,
      name: group.name,
      description: group.description,
      subCategoryId: group.subCategoryId,
      subCategoryName,
      imageUrl: group.imageUrl,
      productCount: group._count.products,
      products: group.products.map((p) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
      })),
    };

    return res.json({ success: true, data });
  })
);

/**
 * POST /admin/products/groups
 * Create product group
 */
router.post(
  '/groups',
  validateBody(AdminCreateProductGroupSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const body = req.body as AdminCreateProductGroupInput;

    const group = await prisma.productGroup.create({
      data: {
        id: body.id,
        name: body.name,
        description: body.description ?? null,
        subCategoryId: body.subCategoryId,
        imageUrl: body.imageUrl ?? null,
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'PRODUCT_GROUP_CREATE',
        description: `groupId: ${group.id}, name: ${group.name}`,
        entityType: 'product_group',
        entityId: 0,
      },
    });

    logger.info('Product group created', { groupId: group.id, adminId });

    return res.status(201).json({ success: true, data: group });
  })
);

/**
 * PATCH /admin/products/groups/:id
 * Update product group
 */
router.patch(
  '/groups/:id',
  validateBody(AdminUpdateProductGroupSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminUpdateProductGroupInput;

    const existing = await prisma.productGroup.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Product group not found');
    }

    const updateData: Record<string, unknown> = { ...body };

    const group = await prisma.productGroup.update({
      where: { id },
      data: updateData,
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'PRODUCT_GROUP_UPDATE',
        description: `groupId: ${group.id}, name: ${group.name}`,
        entityType: 'product_group',
        entityId: 0,
      },
    });

    logger.info('Product group updated', { groupId: group.id, adminId });

    return res.json({ success: true, data: group });
  })
);

/**
 * DELETE /admin/products/groups/:id
 * Delete product group
 */
router.delete(
  '/groups/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;

    const existing = await prisma.productGroup.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError('Product group not found');
    }

    if (existing._count.products > 0) {
      throw new ValidationError(
        `Cannot delete product group with ${existing._count.products} products. Remove products first.`
      );
    }

    await prisma.productGroup.delete({ where: { id } });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'PRODUCT_GROUP_DELETE',
        description: `groupId: ${id}, name: ${existing.name}`,
        entityType: 'product_group',
        entityId: 0,
      },
    });

    logger.info('Product group deleted', { groupId: id, adminId });

    return res.json({ success: true, message: 'Product group deleted' });
  })
);

// ==================== Product Suggestions ====================

/**
 * GET /admin/products/suggestions/stats
 * Get product suggestions statistics
 */
router.get(
  '/suggestions/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const total = await prisma.productSuggestion.count();
    const pending = await prisma.productSuggestion.count({
      where: { status: 'PENDING' },
    });
    const approved = await prisma.productSuggestion.count({
      where: { status: 'APPROVED' },
    });
    const rejected = await prisma.productSuggestion.count({
      where: { status: 'REJECTED' },
    });

    // Approved this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const approvedThisMonth = await prisma.productSuggestion.count({
      where: {
        status: 'APPROVED',
        reviewedAt: { gte: startOfMonth },
      },
    });

    // Top suggesters
    const suggestionsRaw = await prisma.productSuggestion.groupBy({
      by: ['userId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const topSuggesters = await Promise.all(
      suggestionsRaw.map(async (item) => {
        const user = await prisma.user.findUnique({
          where: { id: item.userId },
          select: {
            id: true,
            profile: { select: { userName: true } },
          },
        });
        return {
          userId: item.userId,
          username: user?.profile?.userName || null,
          suggestionCount: item._count.id,
        };
      })
    );

    const data: AdminProductSuggestionStatsResponse = {
      total,
      pending,
      approved,
      rejected,
      approvedThisMonth,
      topSuggesters,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/products/suggestions
 * List product suggestions with pagination and filters
 */
router.get(
  '/suggestions',
  validateQuery(AdminProductSuggestionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      status?: string;
      userId?: string;
      search?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (q.userId) where.userId = q.userId;
    if (q.search) {
      where.OR = [
        { suggestedName: { contains: q.search, mode: 'insensitive' } },
        { suggestedBrand: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [suggestions, total] = await Promise.all([
      prisma.productSuggestion.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { userName: true } },
            },
          },
        },
      }),
      prisma.productSuggestion.count({ where }),
    ]);

    const data: AdminProductSuggestionListItem[] = suggestions.map((sugg) => ({
      id: sugg.id,
      userId: sugg.userId,
      userEmail: sugg.user.email,
      username: sugg.user.profile?.userName || null,
      suggestedName: sugg.suggestedName,
      suggestedBrand: sugg.suggestedBrand,
      description: sugg.description,
      reason: sugg.reason,
      status: sugg.status,
      createdAt: sugg.createdAt.toISOString(),
      reviewedAt: sugg.reviewedAt?.toISOString() || null,
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/products/suggestions/:id
 * Get product suggestion details
 */
router.get(
  '/suggestions/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const suggestion = await prisma.productSuggestion.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { userName: true } },
          },
        },
      },
    });

    if (!suggestion) {
      throw new NotFoundError('Product suggestion not found');
    }

    const data: AdminProductSuggestionDetailResponse = {
      id: suggestion.id,
      userId: suggestion.userId,
      userEmail: suggestion.user.email,
      username: suggestion.user.profile?.userName || null,
      suggestedName: suggestion.suggestedName,
      suggestedBrand: suggestion.suggestedBrand,
      description: suggestion.description,
      reason: suggestion.reason,
      status: suggestion.status,
      createdAt: suggestion.createdAt.toISOString(),
      reviewedAt: suggestion.reviewedAt?.toISOString() || null,
      updatedAt: suggestion.updatedAt.toISOString(),
      user: {
        id: suggestion.user.id,
        email: suggestion.user.email,
        username: suggestion.user.profile?.userName || null,
      },
    };

    return res.json({ success: true, data });
  })
);

/**
 * PATCH /admin/products/suggestions/:id/approve
 * Approve product suggestion
 */
router.patch(
  '/suggestions/:id/approve',
  validateBody(AdminApproveSuggestionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminApproveSuggestionInput;

    const suggestion = await prisma.productSuggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      throw new NotFoundError('Product suggestion not found');
    }

    if (suggestion.status !== 'PENDING') {
      throw new ValidationError('Only pending suggestions can be approved');
    }

    // Create product from suggestion
    const product = await prisma.product.create({
      data: {
        id: body.productId,
        name: body.productName,
        groupId: body.groupId ?? null,
        brandId: body.brandId ?? null,
      },
    });

    // Update suggestion status
    await prisma.productSuggestion.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'PRODUCT_SUGGESTION_APPROVE',
        description: `suggestionId: ${id}, createdProductId: ${product.id}, suggestedBy: ${suggestion.userId}`,
        entityType: 'product_suggestion',
        entityId: 0,
      },
    });

    logger.info('Product suggestion approved', {
      suggestionId: id,
      productId: product.id,
      adminId,
    });

    return res.json({
      success: true,
      message: 'Product suggestion approved',
      data: { product },
    });
  })
);

/**
 * PATCH /admin/products/suggestions/:id/reject
 * Reject product suggestion
 */
router.patch(
  '/suggestions/:id/reject',
  validateBody(AdminRejectSuggestionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    const body = req.body as AdminRejectSuggestionInput;

    const suggestion = await prisma.productSuggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      throw new NotFoundError('Product suggestion not found');
    }

    if (suggestion.status !== 'PENDING') {
      throw new ValidationError('Only pending suggestions can be rejected');
    }

    // Update suggestion status
    await prisma.productSuggestion.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
      },
    });

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'PRODUCT_SUGGESTION_REJECT',
        description: `suggestionId: ${id}, reason: ${body.reason}, suggestedBy: ${suggestion.userId}`,
        entityType: 'product_suggestion',
        entityId: 0,
      },
    });

    logger.info('Product suggestion rejected', {
      suggestionId: id,
      reason: body.reason,
      adminId,
    });

    return res.json({ success: true, message: 'Product suggestion rejected' });
  })
);

// ==================== User Inventories ====================

/**
 * GET /admin/products/inventories/stats
 * Get user inventories statistics
 */
router.get(
  '/inventories/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const total = await prisma.inventory.count();

    const uniqueUsers = await prisma.inventory.groupBy({
      by: ['userId'],
      _count: { id: true },
    });

    const uniqueProducts = await prisma.inventory.groupBy({
      by: ['productId'],
      _count: { id: true },
    });

    const data: AdminInventoryStatsResponse = {
      total,
      uniqueUsers: uniqueUsers.length,
      uniqueProducts: uniqueProducts.length,
    };

    return res.json({ success: true, data });
  })
);

/**
 * GET /admin/products/inventories
 * List user inventories with pagination and filters
 */
router.get(
  '/inventories',
  validateQuery(AdminInventoriesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      limit: number;
      offset: number;
      userId?: string;
      productId?: string;
      search?: string;
      sort: string;
      order: 'asc' | 'desc';
    };

    const where: Record<string, unknown> = {};
    if (q.userId) where.userId = q.userId;
    if (q.productId) where.productId = q.productId;
    if (q.search) {
      where.OR = [
        {
          user: {
            profile: {
              userName: { contains: q.search, mode: 'insensitive' },
            },
          },
        },
        {
          product: {
            name: { contains: q.search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [inventories, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        orderBy: { [q.sort]: q.order },
        take: q.limit,
        skip: q.offset,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { userName: true } },
            },
          },
          product: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: { media: true },
          },
        },
      }),
      prisma.inventory.count({ where }),
    ]);

    const data: AdminInventoryListItem[] = inventories.map((inv) => ({
      id: inv.id,
      userId: inv.userId,
      userEmail: inv.user.email,
      username: inv.user.profile?.userName || null,
      productId: inv.productId,
      productName: inv.product.name,
      experienceSummary: inv.experienceSummary,
      hasMedia: inv._count.media > 0,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
    }));

    const pagination: PaginationMeta = { total, limit: q.limit, offset: q.offset };
    return res.json({ success: true, data, pagination });
  })
);

/**
 * GET /admin/products/inventories/:id
 * Get inventory details
 */
router.get(
  '/inventories/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const inventory = await prisma.inventory.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { userName: true } },
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
        media: {
          select: {
            id: true,
            mediaUrl: true,
            uploadedAt: true,
          },
        },
      },
    });

    if (!inventory) {
      throw new NotFoundError('Inventory not found');
    }

    const data: AdminInventoryDetailResponse = {
      id: inventory.id,
      userId: inventory.userId,
      userEmail: inventory.user.email,
      username: inventory.user.profile?.userName || null,
      productId: inventory.productId,
      productName: inventory.product.name,
      experienceSummary: inventory.experienceSummary,
      hasMedia: inventory.media.length > 0,
      createdAt: inventory.createdAt.toISOString(),
      updatedAt: inventory.updatedAt.toISOString(),
      product: {
        id: inventory.product.id,
        name: inventory.product.name,
        imageUrl: inventory.product.imageUrl,
      },
      media: inventory.media.map((m) => ({
        id: m.id,
        mediaUrl: m.mediaUrl,
        uploadedAt: m.uploadedAt.toISOString(),
      })),
    };

    return res.json({ success: true, data });
  })
);

export default router;
