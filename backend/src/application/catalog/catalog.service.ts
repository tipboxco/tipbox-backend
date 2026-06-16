import { Prisma } from '@prisma/client';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import logger from '../../infrastructure/logger/logger';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { withCache } from '../../infrastructure/cache/cache-wrapper.helper';
import { CACHE_KEYS } from '../../infrastructure/cache/cache-keys';
import { CACHE_TTL } from '../../infrastructure/cache/cache-ttl';
import { FeedItem, FeedItemType } from '../../interfaces/feed/feed.dto';
import { ContextType } from '../../domain/content/context-type.enum';
import { ContentPostType } from '../../domain/content/content-post-type.enum';
import { IdResolverService } from '../../infrastructure/ids/id-resolver.service';

const prisma = getPrisma();

/** Feed item shape used by catalog endpoints (lighter than full FeedItem) */
interface CatalogFeedItem {
  type: string;
  data: Record<string, unknown>;
}

/** Context data shape for catalog posts */
interface CatalogContextData {
  id: string;
  name: string;
  subName: string;
  image: string | null;
}

/** Category row shape from Prisma select */
interface CategoryRow {
  id: string;
  name: string;
  thumbnail: string | null;
}

/** Category row with parentId */
interface CategoryWithParentRow {
  id: string;
  name: string;
  thumbnail: string | null;
  parentId: string | null;
}

/** Product row shape from Prisma select */
interface ProductRow {
  id: string;
  name: string;
  imageUrl: string | null;
  categoryId: string | null;
}

/** Structural type for posts passed to buildContextDataFromPost */
interface CatalogPostForContext {
  product?: {
    id: string;
    name: string;
    imageUrl: string | null;
    group?: {
      name: string;
      imageUrl: string | null;
      subCategory?: {
        name: string;
        imageUrl: string | null;
        mainCategory?: { name: string; imageUrl: string | null } | null;
      } | null;
    } | null;
  } | null;
  productGroup?: {
    id: string;
    name: string;
    imageUrl: string | null;
    subCategory?: {
      name: string;
      imageUrl: string | null;
      mainCategory?: { name: string; imageUrl: string | null } | null;
    } | null;
  } | null;
  subCategory?: {
    id: string;
    name: string;
    imageUrl: string | null;
    mainCategory?: { name: string; imageUrl: string | null } | null;
  } | null;
}

export interface CategoryItem {
  categoryId: string;
  name: string;
  image: string | null;
}

// Medusa: Category tablosunda level ile ayrım (0=main, 1=sub, 2=group)
export interface SubCategoryItem {
  subCategoryId: string; // Medusa Category ID (level=1)
  name: string;
  image: string | null;
  categoryId: string; // Main Category ID (parent)
  categoryName?: string; // Üst kategori adı (breadcrumb için; arama sonuçlarında doldurulur)
}

export interface ProductGroupItem {
  productGroupId: string; // Medusa Category ID (level=2)
  name: string;
  image: string | null;
  subCategoryId: string; // Sub Category ID (parent)
  subCategoryName?: string; // Üst alt-kategori adı (breadcrumb için)
  categoryName?: string; // Kök kategori adı (breadcrumb için)
}

export interface ProductItem {
  productId: string; // Medusa Product ID
  name: string;
  image: string | null;
  productGroupId: string; // Product Group ID (parent)
}

/** Bir kategori subtree'sinde bulunan marka facet'i (yatay marka filtresi için) */
export interface BrandFilterItem {
  id: string; // Brand.id (UUID) — marka detay sayfasına (BrandDetailScreen) yönlendirmede kullanılır
  brandId: string; // Product.brandId === Brand.externalId — ürün filtrelemede kullanılan değer
  name: string;
  image: string | null;
  productCount: number;
}

export interface ProductDetail {
  productId: string;
  name: string;
  subName: string | null;
  description: string | null;
  image: string | null;
  brand: {
    id: string;
    name: string;
    image: string | null;
  } | null;
  specs: string[];
  price: number | null;
  currency: string | null;
}

export class CatalogService {
  private readonly idResolver = new IdResolverService();

  /** IdResolver'a delege eder. */
  private async resolveCategoryId(categoryId: string): Promise<string> {
    return this.idResolver.resolveCategoryId(categoryId);
  }

  /**
   * Bir category id için kendisi + tüm alt (descendant) category id'lerini döndürür.
   * categories tablosundaki parent_id hiyerarşisine göre rekürsif.
   */
  private async getAllDescendantCategoryIds(categoryId: string): Promise<string[]> {
    const ids: string[] = [categoryId];
    const children = await prisma.category.findMany({
      where: { parentId: categoryId },
      select: { id: true },
    });
    for (const child of children) {
      const childDescendants = await this.getAllDescendantCategoryIds(child.id);
      ids.push(...childDescendants);
    }
    return ids;
  }

  /**
   * Tüm kategorileri listele
   */
  async getAllCategories(): Promise<CategoryItem[]> {
    return withCache(
      CACHE_KEYS.STATIC_CATEGORIES()+"asdad",
      async () => {
        const categories = await prisma.category.findMany({
          select: {
            id: true,
            name: true,
            thumbnail: true,
            
          },
          where: {
            level: 0
          }
        });
        const { resolveMediaUrl } = await import('../../infrastructure/config/media.config');

        return categories.map((category: CategoryRow) => {
          const imageUrl = resolveMediaUrl(category.thumbnail);

          return {
            categoryId: category.id,
            name: category.name,
            image: imageUrl,
          };
        });
      },
      15,
      //CACHE_TTL.STATIC_CATEGORIES, // 24 saat - kategoriler çok nadir değişir
      { logPrefix: 'CatalogService' }
    );
  }

  /**
   * Kategoriye göre sub-kategorileri listele (cursor-based pagination)
   */
  async getSubCategoriesByCategoryId(
    categoryId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{
    items: SubCategoryItem[];
    pagination: {
      cursor?: string;
      hasMore: boolean;
      limit: number;
    };
  }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const cursor = options?.cursor;

    try {
      // Category ID'yi resolve et - tüm ID formatlarını kabul eder
      const resolvedCategoryId = await this.resolveCategoryId(categoryId);

      const subCatWhere: Prisma.CategoryWhereInput = {
        parentId: resolvedCategoryId,
        ...(cursor && { id: { gt: cursor } }),
      };

      const subCategories = await prisma.category.findMany({
        where: subCatWhere,
        select: {
          id: true,
          name: true,
          thumbnail: true,
        },
        orderBy: {
          id: 'asc', // Cursor-based pagination için id'ye göre sırala
        },
        take: limit + 1, // Bir fazla al ki hasMore'u kontrol edebilelim
      });

      const hasMore = subCategories.length > limit;
      const resultSubCategories = hasMore ? subCategories.slice(0, limit) : subCategories;
      const nextCursor = hasMore && resultSubCategories.length > 0 
        ? resultSubCategories[resultSubCategories.length - 1].id 
        : undefined;

      const items = resultSubCategories.map((subCategory) => {
        const imageUrl = resolveMediaUrl(subCategory.thumbnail);

        return {
          subCategoryId: subCategory.id, // ✅ Sub-Category ID (Medusa Category ID, level=1)
          name: subCategory.name,
          image: imageUrl,
          categoryId: resolvedCategoryId, // ✅ Main Category ID (parent)
        };
      });

      return {
        items,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get sub-categories for category ${categoryId}:`, error);
      throw error;
    }
  }

  /**
   * Sub-kategoriye göre product group'ları listele (cursor-based pagination)
   */
  async getProductGroupsBySubCategoryId(
    subCategoryId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{
    items: ProductGroupItem[];
    pagination: {
      cursor?: string;
      hasMore: boolean;
      limit: number;
    };
  }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const cursor = options?.cursor;

    try {
      // Sub Category ID'yi resolve et - tüm ID formatlarını kabul eder
      const resolvedSubCategoryId = await this.resolveCategoryId(subCategoryId);

      const prodGroupWhere: Prisma.CategoryWhereInput = {
        parentId: resolvedSubCategoryId,
        ...(cursor && { id: { gt: cursor } }),
      };

      const productGroups = await prisma.category.findMany({
        where: prodGroupWhere,
        select: {
          id: true,
          name: true,
          thumbnail: true,
          parentId: true,
        },
        orderBy: {
          id: 'asc', // Cursor-based pagination için id'ye göre sırala
        },
        take: limit + 1, // Bir fazla al ki hasMore'u kontrol edebilelim
      });

      const hasMore = productGroups.length > limit;
      const resultProductGroups = hasMore ? productGroups.slice(0, limit) : productGroups;
      const nextCursor = hasMore && resultProductGroups.length > 0 
        ? resultProductGroups[resultProductGroups.length - 1].id 
        : undefined;

      const items = resultProductGroups.map((group) => {
        const imageUrl = resolveMediaUrl(group.thumbnail);

        return {
          productGroupId: group.id, // ✅ Product Group ID (Medusa Category ID, level=2)
          name: group.name,
          image: imageUrl,
          subCategoryId: group.parentId || '', // ✅ Sub Category ID (parent)
        };
      });

      return {
        items,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get product groups for sub-category ${subCategoryId}:`, error);
      throw error;
    }
  }

  /**
   * Product group'a göre ürünleri listele (cursor-based pagination)
   */
  async getProductsByProductGroupId(
    productGroupId: string,
    search?: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{
    items: ProductItem[];
    pagination: {
      cursor?: string;
      hasMore: boolean;
      limit: number;
    };
  }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const cursor = options?.cursor;
    const searchTrimmed = search?.trim();

    // Helper: kategori için tüm alt kategori id'lerini rekürsif olarak bul (kendisi dahil)
    async function getAllDescendantCategoryIds(categoryId: string): Promise<string[]> {
      const ids: string[] = [categoryId];

      // İlk seviye children
      const children = await prisma.category.findMany({
        where: { parentId: categoryId },
        select: { id: true },
      });

      for (const child of children) {
        const childDescendants = await getAllDescendantCategoryIds(child.id);
        ids.push(...childDescendants);
      }

      return ids;
    }

    try {
      // productGroupId ile başla, tüm child/alt kategorilerin id'lerini bul
      const categoryIds = await getAllDescendantCategoryIds(productGroupId);

      const productsByGroupWhere: Prisma.ProductWhereInput = {
        categoryId: { in: categoryIds },
        ...(searchTrimmed && {
          OR: [
            { name: { contains: searchTrimmed, mode: 'insensitive' as const } },
            { brand: { name: { contains: searchTrimmed, mode: 'insensitive' as const } } },
            { description: { contains: searchTrimmed, mode: 'insensitive' as const } },
          ],
        }),
        ...(cursor && { id: { gt: cursor } }),
      };

      const products = await prisma.product.findMany({
        where: productsByGroupWhere,
        select: {
          id: true,
          name: true,
          imageUrl: true,
          categoryId: true,
        },
        orderBy: {
          id: 'asc', // Cursor-based pagination için id'ye göre sırala
        },
        take: limit + 1, // Bir fazla al ki hasMore'u kontrol edebilelim
      });

      const hasMore = products.length > limit;
      const resultProducts = hasMore ? products.slice(0, limit) : products;
      const nextCursor = hasMore && resultProducts.length > 0 
        ? resultProducts[resultProducts.length - 1].id 
        : undefined;

      const items = resultProducts.map((product) => {
        const imageUrl = resolveMediaUrl(product.imageUrl);

        return {
          productId: product.id,
          name: product.name,
          image: imageUrl,
          productGroupId: product.categoryId || '', // ✅ Product Group ID (parent)
        };
      });

      return {
        items,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get products for product group ${productGroupId}:`, error);
      throw error;
    }
  }

  /**
   * Bir kategori (kendisi dahil) için tüm alt kategori id'lerini TEK SORGUDA bulur.
   * Tüm kategorileri bir kez yükleyip in-memory BFS yapar (recursive N+1 yerine).
   */
  private async getDescendantCategoryIdsFast(rootCategoryId: string): Promise<string[]> {
    const allCategories = await prisma.category.findMany({
      select: { id: true, parentId: true },
    });

    const parentChildMap = new Map<string, string[]>();
    for (const cat of allCategories) {
      if (!cat.parentId) continue;
      if (!parentChildMap.has(cat.parentId)) parentChildMap.set(cat.parentId, []);
      parentChildMap.get(cat.parentId)!.push(cat.id);
    }

    const result = new Set<string>([rootCategoryId]);
    const toProcess: string[] = [rootCategoryId];
    while (toProcess.length > 0) {
      const currentId = toProcess.shift()!;
      const children = parentChildMap.get(currentId) || [];
      for (const childId of children) {
        if (!result.has(childId)) {
          result.add(childId);
          toProcess.push(childId);
        }
      }
    }

    return Array.from(result);
  }

  /**
   * Bir kategori (herhangi bir seviye) ve tüm alt kategorilerindeki ürünlere ait
   * marka facet listesini döndürür. Yatay marka filtresi (scroll-x) için kullanılır.
   * brandId === Product.brandId === Brand.externalId (ürün filtrelemede kullanılan değer).
   */
  async getBrandsByCategory(categoryId: string): Promise<{ items: BrandFilterItem[] }> {
    try {
      const resolvedCategoryId = await this.resolveCategoryId(categoryId);
      const categoryIds = await this.getDescendantCategoryIdsFast(resolvedCategoryId);

      // Subtree'deki ürünleri brandId'ye göre grupla + say
      const grouped = await prisma.product.groupBy({
        by: ['brandId'],
        where: {
          categoryId: { in: categoryIds },
          brandId: { not: null },
        },
        _count: { _all: true },
      });

      if (grouped.length === 0) {
        return { items: [] };
      }

      const countByExternalId = new Map<string, number>();
      for (const row of grouped) {
        if (row.brandId) countByExternalId.set(row.brandId, row._count._all);
      }

      const brands = await prisma.brand.findMany({
        where: { externalId: { in: Array.from(countByExternalId.keys()) } },
        select: { id: true, externalId: true, name: true, logoUrl: true, imageUrl: true },
      });

      const items: BrandFilterItem[] = brands
        .filter((b) => b.externalId !== null)
        .map((b) => ({
          id: b.id,
          brandId: b.externalId as string,
          name: b.name,
          image: resolveMediaUrl(b.logoUrl ?? b.imageUrl),
          productCount: countByExternalId.get(b.externalId as string) ?? 0,
        }))
        .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name));

      return { items };
    } catch (error) {
      logger.error(`Failed to get brands for category ${categoryId}:`, error);
      throw error;
    }
  }

  /**
   * Bir kategori (herhangi bir seviye) ve tüm alt kategorilerindeki ürünleri listeler.
   * Opsiyonel brandId (Brand.externalId) ile markaya göre filtreler. Cursor-based pagination.
   */
  async getProductsByCategory(
    categoryId: string,
    options?: { brandId?: string; search?: string; cursor?: string; limit?: number }
  ): Promise<{
    items: ProductItem[];
    pagination: {
      cursor?: string;
      hasMore: boolean;
      limit: number;
    };
  }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const cursor = options?.cursor;
    const brandId = options?.brandId?.trim();
    const searchTrimmed = options?.search?.trim();

    try {
      const resolvedCategoryId = await this.resolveCategoryId(categoryId);
      const categoryIds = await this.getDescendantCategoryIdsFast(resolvedCategoryId);

      const productsWhere: Prisma.ProductWhereInput = {
        categoryId: { in: categoryIds },
        ...(brandId && { brandId }),
        ...(searchTrimmed && {
          OR: [
            { name: { contains: searchTrimmed, mode: 'insensitive' as const } },
            { brand: { name: { contains: searchTrimmed, mode: 'insensitive' as const } } },
            { description: { contains: searchTrimmed, mode: 'insensitive' as const } },
          ],
        }),
        ...(cursor && { id: { gt: cursor } }),
      };

      const products = await prisma.product.findMany({
        where: productsWhere,
        select: {
          id: true,
          name: true,
          imageUrl: true,
          categoryId: true,
        },
        orderBy: {
          id: 'asc',
        },
        take: limit + 1,
      });

      const hasMore = products.length > limit;
      const resultProducts = hasMore ? products.slice(0, limit) : products;
      const nextCursor =
        hasMore && resultProducts.length > 0
          ? resultProducts[resultProducts.length - 1].id
          : undefined;

      const items = resultProducts.map((product) => ({
        productId: product.id,
        name: product.name,
        image: resolveMediaUrl(product.imageUrl),
        productGroupId: product.categoryId || '',
      }));

      return {
        items,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get products for category ${categoryId}:`, error);
      throw error;
    }
  }

  /**
   * Product detay bilgilerini getir (Medusa: Product.categoryId + Category breadcrumb; legacy: group.subCategory.mainCategory).
   */
  async getProductById(productId: string): Promise<ProductDetail> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          category: {
            select: { id: true, name: true, parentId: true },
            include: { parent: { select: { id: true, name: true } } },
          },
          group: {
            include: {
              subCategory: { include: { mainCategory: true } },
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              imageUrl: true,
            },
          },
        },
      });

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      const subName =
        product.subName ??
        product.category?.name ??
        product.category?.parent?.name ??
        product.group?.name ??
        product.group?.subCategory?.name ??
        null;

      let brandData: { id: string; name: string; image: string | null } | null = null;
      if (product.brand) {
        brandData = {
          id: product.brand.id,
          name: product.brand.name,
          image: resolveMediaUrl(product.brand.logoUrl ?? product.brand.imageUrl),
        };
      }

      const specs: string[] = [];
      const price: number | null = null;
      const currency: string | null = null;

      return {
        productId: product.id,
        name: product.name,
        subName,
        description: product.description,
        image: resolveMediaUrl(product.imageUrl ?? product.thumbnail),
        brand: brandData,
        specs,
        price,
        currency,
      };
    } catch (error) {
      logger.error(`Failed to get product detail for ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Context ID'ye göre otomatik olarak doğru post listesini döndürür
   * Context: main_category, sub_category, product_group, product
   * ID prefix veya veritabanı sorgusu ile context type'ı otomatik belirlenir
   */
  async getContextPosts(
    contextId: string,
    userId?: string,
    options?: { 
      cursor?: string; 
      limit?: number; 
      filter?: string;
      sort?: string;
    }
  ): Promise<{
    items: CatalogFeedItem[];
    pagination: { cursor?: string; hasMore: boolean; limit: number };
    contextType: string; // Hangi context'ten geldiğini frontend'e bildir
  }> {
    const trimmedId = contextId.trim();
    
    // 1. Önce Product mı kontrol et (prod_ prefix veya product tablosunda var mı)
    if (trimmedId.startsWith('prod_')) {
      try {
        const result = await this.getProductPosts(trimmedId, userId, options);
        return { ...result, contextType: 'product' };
      } catch (error) {
        logger.debug(`Not a product: ${trimmedId}`);
      }
    }
    
    // 2. Category kontrol et (pcat_ prefix veya categories tablosunda var mı)
    if (trimmedId.startsWith('pcat_')) {
      try {
        // Categories tablosunda var mı ve parent_id'si var mı kontrol et
        const category = await prisma.category.findUnique({
          where: { id: trimmedId },
          select: { id: true, parentId: true },
        });
        
        if (category) {
          if (category.parentId) {
            // Sub Category
            const result = await this.getSubCategoryPosts(trimmedId, userId, options);
            return { ...result, contextType: 'sub_category' };
          } else {
            // Main Category
            const result = await this.getMainCategoryPosts(trimmedId, userId, options);
            return { ...result, contextType: 'main_category' };
          }
        }
      } catch (error) {
        logger.debug(`Not a category: ${trimmedId}`);
      }
    }
    
    // 3. UUID formatındaysa, her yerde ara
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(trimmedId)) {
      // ProductGroup kontrol et
      try {
        const productGroup = await prisma.productGroup.findUnique({
          where: { id: trimmedId },
          select: { id: true },
        });
        if (productGroup) {
          const result = await this.getProductGroupPosts(trimmedId, userId, options);
          return { ...result, contextType: 'product_group' };
        }
      } catch (error) {
        logger.debug(`Not a product group: ${trimmedId}`);
      }
      
      // SubCategory kontrol et (UUID format)
      try {
        const subCategory = await prisma.subCategory.findUnique({
          where: { id: trimmedId },
          select: { id: true },
        });
        if (subCategory) {
          const result = await this.getSubCategoryPosts(trimmedId, userId, options);
          return { ...result, contextType: 'sub_category' };
        }
      } catch (error) {
        logger.debug(`Not a sub category: ${trimmedId}`);
      }
      
      // MainCategory kontrol et (UUID format)
      try {
        const mainCategory = await prisma.mainCategory.findUnique({
          where: { id: trimmedId },
          select: { id: true },
        });
        if (mainCategory) {
          const result = await this.getMainCategoryPosts(trimmedId, userId, options);
          return { ...result, contextType: 'main_category' };
        }
      } catch (error) {
        logger.debug(`Not a main category: ${trimmedId}`);
      }
    }
    
    throw new Error(`Context not found with ID: ${contextId}`);
  }

  /**
   * Product'a ait post'ları getir
   * Filtreler: all, free, tips_and_tricks, questions, updates, benchmarks, reviews
   * Sıralama: newest, oldest, most_popular
   */
  async getProductPosts(
    productId: string,
    userId?: string,
    options?: { 
      cursor?: string; 
      limit?: number; 
      filter?: string; // all, free, tips_and_tricks, questions, updates, benchmarks, reviews
      sort?: string; // newest, oldest, most_popular
    }
  ): Promise<{
    items: CatalogFeedItem[];
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    try {
      const actualProductId = await this.idResolver.resolveProductId(productId.trim());
      const product = await prisma.product.findUnique({
        where: { id: actualProductId },
      });

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
      const cursor = options?.cursor;
      const filter = options?.filter || 'all'; // all, tips_and_tricks, questions, updates, benchmarks, reviews
      const sort = options?.sort || 'newest'; // newest, oldest, most_popular

      // Filtreleme: Product için (FREE hariç: EXPERIENCE, TIPS, COMPARE, QUESTION, UPDATE)
      let typeFilter: ContentPostType[] | undefined;
      if (filter === 'tips_and_tricks') {
        typeFilter = [ContentPostType.TIPS];
      } else if (filter === 'questions') {
        typeFilter = [ContentPostType.QUESTION];
      } else if (filter === 'updates') {
        typeFilter = [ContentPostType.UPDATE];
      } else if (filter === 'benchmarks') {
        typeFilter = [ContentPostType.COMPARE];
      } else if (filter === 'reviews') {
        typeFilter = [ContentPostType.EXPERIENCE, ContentPostType.UPDATE];
      } else if (filter === 'all') {
        // Product için izin verilen tüm post tipleri (FREE hariç)
        typeFilter = this.getAllowedPostTypesForContext(ContextType.PRODUCT);
      }

      const productPostsWhere: Prisma.ContentPostWhereInput = {
        productId: actualProductId,
        ...(typeFilter && { type: { in: typeFilter } }),
      };

      const posts = await prisma.contentPost.findMany({
        where: productPostsWhere,
        include: {
          user: {
            include: {
              profile: true,
              titles: {
                orderBy: { earnedAt: 'desc' },
                take: 1,
              },
              avatars: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
          product: {
            include: {
              group: {
                include: {
                  subCategory: {
                    include: {
                      mainCategory: true,
                    },
                  },
                },
              },
            },
          },
          productGroup: {
            include: {
              subCategory: {
                include: {
                  mainCategory: true,
                },
              },
            },
          },
          comparison: {
            include: {
              product1: true,
              product2: true,
              scores: true,
            },
          },
          question: true,
          tip: true,
          tags: true,
          contentPostTags: true,
          likes: true,
          comments: true,
          favorites: true,
          media: {
            orderBy: { orderIndex: 'asc' },
          },
        },
        // Sıralama
        ...(sort === 'most_popular' 
          ? {} // Most popular için önce tüm postları alıp sonra sıralayacağız
          : {
              orderBy: sort === 'oldest' 
                ? { createdAt: 'asc' } 
                : { createdAt: 'desc' }
            }
        ),
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      });

      // Most popular sıralaması için beğeni + yorum + kaydetme sayısına göre sırala
      let sortedPosts = posts;
      if (sort === 'most_popular') {
        sortedPosts = posts.sort((a, b) => {
          const aScore = (a.likes?.length || 0) + (a.comments?.length || 0) + (a.favorites?.length || 0);
          const bScore = (b.likes?.length || 0) + (b.comments?.length || 0) + (b.favorites?.length || 0);
          return bScore - aScore; // Yüksekten düşüğe
        });
      }

      const hasMore = sortedPosts.length > limit;
      const resultPosts = hasMore ? sortedPosts.slice(0, limit) : sortedPosts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1].id : undefined;

      // Kullanıcının sahip olduğu ürünler (experience post product.isOwned için)
      let ownedProductIds = new Set<string>();
      if (userId) {
        const inventories = await prisma.inventory.findMany({
          where: { userId },
          select: { productId: true },
        });
        ownedProductIds = new Set(inventories.map((inv) => String(inv.productId)));
      }

      // Map ContentPostType to FeedItemType (UPDATE ayrı tip; Experience/Reviews tabında listelenir)
      const mapContentPostTypeToFeedItemType = (type: ContentPostType): FeedItemType => {
        switch (type) {
          case ContentPostType.EXPERIENCE:
            return FeedItemType.EXPERIENCE;
          case ContentPostType.UPDATE:
            return FeedItemType.UPDATE;
          case ContentPostType.COMPARE:
            return FeedItemType.BENCHMARK;
          case ContentPostType.QUESTION:
            return FeedItemType.QUESTION;
          case ContentPostType.TIPS:
            return FeedItemType.TIPS_AND_TRICKS;
          default:
            return FeedItemType.POST;
        }
      };

      // Convert posts to feed items (experience: profil/feed ile aynı yapı)
      const feedItems: CatalogFeedItem[] = resultPosts.map((post) => {
        const baseType = mapContentPostTypeToFeedItemType(post.type as ContentPostType);
        const contextData = this.buildContextDataFromPost(post);
        const images = (post.media || []).map((m: { mediaUrl: string }) => resolveMediaUrl(m.mediaUrl)).filter((url: string | null): url is string => url !== null);

        const baseData: Record<string, unknown> = {
          id: post.id,
          type: baseType,
          user: {
            id: post.user.id,
            name: post.user.profile?.displayName || post.user.email || 'Anonymous',
            avatar: resolveMediaUrl(post.user.avatars?.[0]?.imageUrl || null, true) || '',
          },
          stats: {
            likes: post.likesCount ?? post.likes?.length ?? 0,
            comments: post.commentsCount ?? post.comments?.length ?? 0,
            shares: post.sharesCount ?? 0,
            bookmarks: post.favoritesCount ?? post.favorites?.length ?? 0,
          },
          createdAt: post.createdAt.toISOString(),
          contextType: post.product ? ContextType.PRODUCT : post.productGroup ? ContextType.PRODUCT_GROUP : ContextType.SUB_CATEGORY,
          contextData: contextData,
          content: post.body,
          images,
          status: (post.productStatus === 'own' || post.productStatus === 'tried' ? post.productStatus : null) as 'own' | 'tried' | null,
          statusLabel: post.productStatus === 'own' ? 'I owned' : post.productStatus === 'tried' ? 'I tried' : null,
          isBoosted: post.isBoosted ?? false,
          boostedUntil: post.boostedUntil ? (post.boostedUntil as Date).toISOString() : null,
        };

        const updateContent = post as unknown as { updateContent?: { experiencePost?: Record<string, unknown>; content?: string } };
        if (post.type === ContentPostType.UPDATE && updateContent.updateContent?.experiencePost) {
          const expPost = updateContent.updateContent.experiencePost as Record<string, unknown>;
          const expPostProduct = expPost.product as { id: string; name: string; imageUrl: string | null; group?: { name: string } | null } | null;
          const expProduct = expPostProduct
            ? {
                id: expPostProduct.id,
                name: expPostProduct.name,
                subName: expPostProduct.group?.name ?? '',
                image: resolveMediaUrl(expPostProduct.imageUrl) ?? null,
                isOwned: expPost.productId ? ownedProductIds.has(String(expPost.productId)) : false,
              }
            : { id: (expPost.productId as string) || '', name: '', subName: '', image: null, isOwned: false };
          const expContent = this.parseExperienceContentForCatalog(expPost.body as string);
          const expContentString =
            expContent.length > 0
              ? expContent.map((item: { title: string; content: string; rating: number }) => `${item.title}: ${item.content}${item.rating ? ` (${item.rating}/5)` : ''}`).join('\n\n')
              : (expPost.body as string) || '';
          const expPostTags = expPost.contentPostTags as Array<{ tag: string }> | undefined;
          baseData.relatedPost = {
            id: String(expPost.id),
            product: expProduct,
            content: expContentString,
            experienceContent: expContent,
            tags: expPostTags?.map((t: { tag: string }) => t.tag) || [],
            images: [],
            status: (expPost.productStatus as string) ?? null,
            statusLabel: expPost.productStatus === 'own' ? 'I owned' : expPost.productStatus === 'tried' ? 'I tried' : null,
          };
          baseData.content = updateContent.updateContent.content || post.body;
          baseData.tags = post.contentPostTags?.map((t: { tag: string }) => t.tag) || post.tags?.map((t: { tag: string }) => t.tag) || [];
        } else if (post.type === ContentPostType.EXPERIENCE || post.type === ContentPostType.UPDATE) {
          baseData.product = {
            ...contextData,
            isOwned: post.productId ? ownedProductIds.has(String(post.productId)) : false,
          };
          baseData.experienceContent = this.parseExperienceContentForCatalog(post.body);
          baseData.tags = post.contentPostTags?.map((t: { tag: string }) => t.tag) || post.tags?.map((t: { tag: string }) => t.tag) || [];
        }

        return {
          type: baseType,
          data: baseData,
        };
      });

      return {
        items: feedItems,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get product posts for ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Context seviyesine göre izin verilen post tiplerini döndürür
   */
  private getAllowedPostTypesForContext(contextType: ContextType): ContentPostType[] {
    switch (contextType) {
      case ContextType.SUB_CATEGORY:
      case ContextType.PRODUCT_GROUP:
        // Sub category ve product group için sadece Free, Tips, Question
        return [ContentPostType.FREE, ContentPostType.TIPS, ContentPostType.QUESTION];
      case ContextType.PRODUCT:
        // Product için: Experience, Tips, Compare, Question, Update (FREE hariç)
        return [
          ContentPostType.TIPS,
          ContentPostType.QUESTION,
          ContentPostType.EXPERIENCE,
          ContentPostType.UPDATE,
          ContentPostType.COMPARE,
        ];
      default:
        return [];
    }
  }

  /**
   * Post'tan context data oluşturur
   */
  private buildContextDataFromPost(post: CatalogPostForContext): CatalogContextData {
    // Product context
    if (post.product) {
      const product = post.product;
      const group = product.group;
      const subCategory = group?.subCategory;
      const mainCategory = subCategory?.mainCategory;
      const imagePath = product.imageUrl || group?.imageUrl || subCategory?.imageUrl || mainCategory?.imageUrl || null;

      return {
        id: product.id,
        name: product.name,
        subName: group?.name || subCategory?.name || '',
        image: resolveMediaUrl(imagePath),
      };
    }

    // Product Group context
    if (post.productGroup) {
      const group = post.productGroup;
      const subCategory = group.subCategory;
      const mainCategory = subCategory?.mainCategory;
      const imagePath = group.imageUrl || subCategory?.imageUrl || mainCategory?.imageUrl || null;

      return {
        id: group.id,
        name: group.name,
        subName: subCategory?.name || mainCategory?.name || '',
        image: resolveMediaUrl(imagePath),
      };
    }

    // Sub Category context
    if (post.subCategory) {
      const subCategory = post.subCategory;
      const mainCategory = subCategory.mainCategory;
      const imagePath = subCategory.imageUrl || mainCategory?.imageUrl || null;

      return {
        id: subCategory.id,
        name: subCategory.name,
        subName: mainCategory?.name || '',
        image: resolveMediaUrl(imagePath),
      };
    }

    return {
      id: '',
      name: '',
      subName: '',
      image: null,
    };
  }

  /** Experience post body'den experienceContent array üretir (feed ile aynı yapı) */
  private parseExperienceContentForCatalog(body: string): Array<{ title: string; content: string; rating: number }> {
    if (!body) {
      return [{ title: 'Product and Usage Experience', content: '', rating: 0 }];
    }
    const content: Array<{ title: string; content: string; rating: number }> = [];
    const priceMatch = body.match(/\[(?:price_and_shopping|Price and Shopping)[^\]]*\]\s*(.*?)\s*\(Rating:\s*(\d+)\/5\)/is);
    const usageMatch = body.match(/\[(?:product_and_usage|Product and Usage)[^\]]*\]\s*(.*?)\s*\(Rating:\s*(\d+)\/5\)/is);
    if (priceMatch) content.push({ title: 'Price and Shopping Experience', content: priceMatch[1].trim(), rating: Math.min(5, Math.max(1, parseInt(priceMatch[2], 10))) });
    if (usageMatch) content.push({ title: 'Product and Usage Experience', content: usageMatch[1].trim(), rating: Math.min(5, Math.max(1, parseInt(usageMatch[2], 10))) });
    if (content.length === 0) {
      const ratingMatch = body.match(/Rating:\s*(\d+)/i);
      const r = ratingMatch ? Math.min(5, Math.max(1, parseInt(ratingMatch[1], 10))) : 0;
      content.push({ title: 'Price and Shopping Experience', content: body, rating: r });
      content.push({ title: 'Product and Usage Experience', content: body, rating: r });
    }
    return content;
  }

  /**
   * Sub category'ye ait post'ları getir (hiyerarşik feed)
   * Sub category'ye ait + alt product group'ların + alt product'ların gönderilerini getirir
   * Filtreler: all, free, tips_and_tricks, questions
   * Sıralama: newest, oldest, most_popular
   */
  async getSubCategoryPosts(
    subCategoryId: string,
    userId?: string,
    options?: { 
      cursor?: string; 
      limit?: number; 
      filter?: string; // all, free, tips_and_tricks, questions
      sort?: string; // newest, oldest, most_popular
    }
  ): Promise<{
    items: CatalogFeedItem[];
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    try {
      const trimmedId = subCategoryId.trim();
      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
      const cursor = options?.cursor;
      const filter = options?.filter || 'all';
      const sort = options?.sort || 'newest';

      // Sub-category = categories tablosunda bir düğüm. Altındaki tüm gönderiler:
      // 1) category_id bu düğüm veya alt kategorilerde olan postlar
      // 2) product_id setli ve product.categoryId bu ağaçta olan postlar
      const resolvedCategoryId = await this.resolveCategoryId(trimmedId);
      const descendantCategoryIds = await this.getAllDescendantCategoryIds(resolvedCategoryId);

      let typeFilter: ContentPostType[] | undefined;
      if (filter === 'free') {
        typeFilter = [ContentPostType.FREE];
      } else if (filter === 'tips_and_tricks') {
        typeFilter = [ContentPostType.TIPS];
      } else if (filter === 'questions') {
        typeFilter = [ContentPostType.QUESTION];
      } else {
        typeFilter = this.getAllowedPostTypesForContext(ContextType.SUB_CATEGORY);
      }

      const subCatPostsWhere: Prisma.ContentPostWhereInput = {
        OR: [
          { categoryId: { in: descendantCategoryIds } },
          { productId: { not: null }, product: { categoryId: { in: descendantCategoryIds } } },
        ],
        ...(typeFilter?.length && { type: { in: typeFilter } }),
      };

      const subCatPosts = await prisma.contentPost.findMany({
        where: subCatPostsWhere,
        include: {
          user: {
            include: {
              profile: true,
              titles: {
                orderBy: { earnedAt: 'desc' },
                take: 1,
              },
              avatars: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
          product: {
            include: {
              group: {
                include: {
                  subCategory: {
                    include: {
                      mainCategory: true,
                    },
                  },
                },
              },
            },
          },
          productGroup: {
            include: {
              subCategory: {
                include: {
                  mainCategory: true,
                },
              },
            },
          },
          subCategory: {
            include: {
              mainCategory: true,
            },
          },
          mainCategory: true,
          comparison: {
            include: {
              product1: true,
              product2: true,
              scores: true,
            },
          },
          question: true,
          tip: true,
          tags: true,
          likes: true,
          comments: true,
          favorites: true,
          media: {
            orderBy: { orderIndex: 'asc' },
          },
        },
        // Sıralama
        ...(sort === 'most_popular'
          ? {} // Most popular için önce tüm postları alıp sonra sıralayacağız
          : {
              orderBy: sort === 'oldest'
                ? { createdAt: 'asc' }
                : { createdAt: 'desc' }
            }
        ),
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      });

      // Most popular sıralaması için beğeni + yorum + kaydetme sayısına göre sırala
      let sortedSubCatPosts = subCatPosts;
      if (sort === 'most_popular') {
        sortedSubCatPosts = subCatPosts.sort((a, b) => {
          const aScore = (a.likes?.length || 0) + (a.comments?.length || 0) + (a.favorites?.length || 0);
          const bScore = (b.likes?.length || 0) + (b.comments?.length || 0) + (b.favorites?.length || 0);
          return bScore - aScore; // Yüksekten düşüğe
        });
      }

      const hasMore = sortedSubCatPosts.length > limit;
      const resultPosts = hasMore ? sortedSubCatPosts.slice(0, limit) : sortedSubCatPosts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1].id : undefined;

      // Map ContentPostType to FeedItemType
      const mapContentPostTypeToFeedItemType = (type: ContentPostType): FeedItemType => {
        switch (type) {
          case ContentPostType.EXPERIENCE:
          case ContentPostType.UPDATE:
            return FeedItemType.EXPERIENCE;
          case ContentPostType.COMPARE:
            return FeedItemType.BENCHMARK;
          case ContentPostType.QUESTION:
            return FeedItemType.QUESTION;
          case ContentPostType.TIPS:
            return FeedItemType.TIPS_AND_TRICKS;
          default:
            return FeedItemType.POST;
        }
      };

      // Convert posts to feed items
      const feedItems: CatalogFeedItem[] = resultPosts.map((post) => {
        const baseType = mapContentPostTypeToFeedItemType(post.type as ContentPostType);
        const contextData = this.buildContextDataFromPost(post);

        const baseData = {
          id: post.id,
          type: baseType,
          user: {
            id: post.user.id,
            name: post.user.profile?.displayName || post.user.email || 'Anonymous',
            avatar: resolveMediaUrl(post.user.avatars?.[0]?.imageUrl || null, true) || '',
          },
          stats: {
            likes: post.likesCount ?? post.likes?.length ?? 0,
            comments: post.commentsCount ?? post.comments?.length ?? 0,
            shares: post.sharesCount ?? 0,
            bookmarks: post.favoritesCount ?? post.favorites?.length ?? 0,
          },
          createdAt: post.createdAt.toISOString(),
          contextType: post.product ? ContextType.PRODUCT : post.productGroup ? ContextType.PRODUCT_GROUP : ContextType.SUB_CATEGORY,
          contextData: contextData,
          content: post.body,
          images: (post.media || []).map((m: { mediaUrl: string }) => resolveMediaUrl(m.mediaUrl)).filter((url: string | null): url is string => url !== null),
          isBoosted: post.isBoosted ?? false,
          boostedUntil: post.boostedUntil ? (post.boostedUntil as Date).toISOString() : null,
        };

        return {
          type: baseType,
          data: baseData,
        };
      });

      return {
        items: feedItems,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get sub category posts for ${subCategoryId}:`, error);
      throw error;
    }
  }

  /**
   * Main category'ye ait post'ları getir.
   * Altındaki tüm sub-category ve product group'ları kapsayan hiyerarşik feed.
   * Delegates to getSubCategoryPosts since both use getAllDescendantCategoryIds recursively.
   */
  async getMainCategoryPosts(
    mainCategoryId: string,
    userId?: string,
    options?: {
      cursor?: string;
      limit?: number;
      filter?: string;
      sort?: string;
    }
  ): Promise<{
    items: CatalogFeedItem[];
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    return this.getSubCategoryPosts(mainCategoryId, userId, options);
  }

  /**
   * Product group'a ait post'ları getir (hiyerarşik feed)
   * Product group = categories tablosunda bir düğüm. Altındaki tüm gönderiler:
   * 1) category_id bu düğüm veya alt kategorilerde olan postlar
   * 2) product_id setli ve product.categoryId bu ağaçta olan postlar
   */
  async getProductGroupPosts(
    productGroupId: string,
    userId?: string,
    options?: { 
      cursor?: string; 
      limit?: number; 
      filter?: string; // all, free, tips_and_tricks, questions
      sort?: string; // newest, oldest, most_popular
    }
  ): Promise<{
    items: CatalogFeedItem[];
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    try {
      const trimmedId = productGroupId.trim();
      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
      const cursor = options?.cursor;
      const filter = options?.filter || 'all';
      const sort = options?.sort || 'newest';

      const resolvedCategoryId = await this.resolveCategoryId(trimmedId);
      const descendantCategoryIds = await this.getAllDescendantCategoryIds(resolvedCategoryId);

      let typeFilter: ContentPostType[] | undefined;
      if (filter === 'free') {
        typeFilter = [ContentPostType.FREE];
      } else if (filter === 'tips_and_tricks') {
        typeFilter = [ContentPostType.TIPS];
      } else if (filter === 'questions') {
        typeFilter = [ContentPostType.QUESTION];
      } else {
        typeFilter = this.getAllowedPostTypesForContext(ContextType.PRODUCT_GROUP);
      }

      const pgPostsWhere: Prisma.ContentPostWhereInput = {
        OR: [
          { categoryId: { in: descendantCategoryIds } },
          { productId: { not: null }, product: { categoryId: { in: descendantCategoryIds } } },
        ],
        ...(typeFilter?.length && { type: { in: typeFilter } }),
      };

      const posts = await prisma.contentPost.findMany({
        where: pgPostsWhere,
        include: {
          user: {
            include: {
              profile: true,
              titles: {
                orderBy: { earnedAt: 'desc' },
                take: 1,
              },
              avatars: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
          product: {
            include: {
              group: {
                include: {
                  subCategory: {
                    include: {
                      mainCategory: true,
                    },
                  },
                },
              },
            },
          },
          productGroup: {
            include: {
              subCategory: {
                include: {
                  mainCategory: true,
                },
              },
            },
          },
          subCategory: {
            include: {
              mainCategory: true,
            },
          },
          mainCategory: true,
          comparison: {
            include: {
              product1: true,
              product2: true,
              scores: true,
            },
          },
          question: true,
          tip: true,
          tags: true,
          likes: true,
          comments: true,
          favorites: true,
          media: {
            orderBy: { orderIndex: 'asc' },
          },
        },
        // Sıralama
        ...(sort === 'most_popular' 
          ? {} // Most popular için önce tüm postları alıp sonra sıralayacağız
          : {
              orderBy: sort === 'oldest' 
                ? { createdAt: 'asc' } 
                : { createdAt: 'desc' }
            }
        ),
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      });

      // Most popular sıralaması için beğeni + yorum + kaydetme sayısına göre sırala
      let sortedPosts = posts;
      if (sort === 'most_popular') {
        sortedPosts = posts.sort((a, b) => {
          const aScore = (a.likes?.length || 0) + (a.comments?.length || 0) + (a.favorites?.length || 0);
          const bScore = (b.likes?.length || 0) + (b.comments?.length || 0) + (b.favorites?.length || 0);
          return bScore - aScore; // Yüksekten düşüğe
        });
      }

      const hasMore = sortedPosts.length > limit;
      const resultPosts = hasMore ? sortedPosts.slice(0, limit) : sortedPosts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1].id : undefined;

      // Map ContentPostType to FeedItemType
      const mapContentPostTypeToFeedItemType = (type: ContentPostType): FeedItemType => {
        switch (type) {
          case ContentPostType.EXPERIENCE:
          case ContentPostType.UPDATE:
            return FeedItemType.EXPERIENCE;
          case ContentPostType.COMPARE:
            return FeedItemType.BENCHMARK;
          case ContentPostType.QUESTION:
            return FeedItemType.QUESTION;
          case ContentPostType.TIPS:
            return FeedItemType.TIPS_AND_TRICKS;
          default:
            return FeedItemType.POST;
        }
      };

      // Convert posts to feed items
      const feedItems: CatalogFeedItem[] = resultPosts.map((post) => {
        const baseType = mapContentPostTypeToFeedItemType(post.type as ContentPostType);
        const contextData = this.buildContextDataFromPost(post);

        const baseData = {
          id: post.id,
          type: baseType,
          user: {
            id: post.user.id,
            name: post.user.profile?.displayName || post.user.email || 'Anonymous',
            avatar: resolveMediaUrl(post.user.avatars?.[0]?.imageUrl || null, true) || '',
          },
          stats: {
            likes: post.likesCount ?? post.likes?.length ?? 0,
            comments: post.commentsCount ?? post.comments?.length ?? 0,
            shares: post.sharesCount ?? 0,
            bookmarks: post.favoritesCount ?? post.favorites?.length ?? 0,
          },
          createdAt: post.createdAt.toISOString(),
          contextType: post.product ? ContextType.PRODUCT : post.productGroup ? ContextType.PRODUCT_GROUP : ContextType.SUB_CATEGORY,
          contextData: contextData,
          content: post.body,
          images: (post.media || []).map((m: { mediaUrl: string }) => resolveMediaUrl(m.mediaUrl)).filter((url: string | null): url is string => url !== null),
          isBoosted: post.isBoosted ?? false,
          boostedUntil: post.boostedUntil ? (post.boostedUntil as Date).toISOString() : null,
        };

        return {
          type: baseType,
          data: baseData,
        };
      });

      return {
        items: feedItems,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get product group posts for ${productGroupId}:`, error);
      throw error;
    }
  }

  /**
   * Product'a ait haberleri getir
   */
  async getProductNews(
    productId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{
    items: Array<{
      id: string;
      title: string;
      description: string;
      source: string;
      date: string;
      image: string;
    }>;
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    try {
      // Product'ın var olup olmadığını kontrol et
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { 
          id: true, 
          brand: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
      const cursor = options?.cursor;

      // Product'a ait post'ları haber olarak getir
      const posts = await prisma.contentPost.findMany({
        where: {
          productId: productId,
        },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
          product: {
            include: {
              group: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
      });

      const hasMore = posts.length > limit;
      const resultPosts = hasMore ? posts.slice(0, limit) : posts;
      const nextCursor = hasMore && resultPosts.length > 0 ? resultPosts[resultPosts.length - 1].id : undefined;

      // Haber response formatına dönüştür
      const newsItems = resultPosts.map((post) => {
        const title = post.title || post.body?.slice(0, 80) || 'News';
        const description = post.body || '';
        const source = product.brand?.name || 'tipbox';
        const image =
          post.product?.imageUrl ||
          post.product?.group?.imageUrl ||
          '';

        return {
          id: post.id,
          title,
          description,
          source,
          date: post.createdAt.toISOString(),
          image: resolveMediaUrl(image) || '',
        };
      });

      return {
        items: newsItems,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to get product news for ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Subcategory arama - level=1 kategoriler arasında isim bazlı arama (cursor pagination)
   */
  async searchSubCategories(
    q: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{
    items: SubCategoryItem[];
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;
    const trimmedQ = q.trim();

    const where: Prisma.CategoryWhereInput = {
      level: 1,
      ...(trimmedQ && { name: { contains: trimmedQ, mode: 'insensitive' as const } }),
      ...(cursor && { id: { gt: cursor } }),
    };

    const results = await prisma.category.findMany({
      where,
      select: { id: true, name: true, thumbnail: true, parentId: true },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined;

    // Breadcrumb için üst kategori (level=0) adlarını topluca getir
    const parentIds = Array.from(new Set(items.map((c) => c.parentId).filter((id): id is string => !!id)));
    const parentNameById = await this.getCategoryNameMap(parentIds);

    return {
      items: items.map((c) => ({
        subCategoryId: c.id,
        name: c.name,
        image: resolveMediaUrl(c.thumbnail),
        categoryId: c.parentId || '',
        categoryName: c.parentId ? parentNameById.get(c.parentId) : undefined,
      })),
      pagination: { cursor: nextCursor, hasMore, limit },
    };
  }

  /** Verilen kategori id'leri için id→name haritası döndürür (breadcrumb isimleri için). */
  private async getCategoryNameMap(ids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.length === 0) return map;
    const rows = await prisma.category.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, parentId: true },
    });
    for (const row of rows) map.set(row.id, row.name);
    return map;
  }

  /**
   * Product group arama - level=2 kategoriler arasında isim bazlı arama (cursor pagination)
   */
  async searchProductGroups(
    q: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{
    items: ProductGroupItem[];
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 50) : 20;
    const cursor = options?.cursor;
    const trimmedQ = q.trim();

    const where: Prisma.CategoryWhereInput = {
      level: 2,
      ...(trimmedQ && { name: { contains: trimmedQ, mode: 'insensitive' as const } }),
      ...(cursor && { id: { gt: cursor } }),
    };

    const results = await prisma.category.findMany({
      where,
      select: { id: true, name: true, thumbnail: true, parentId: true },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined;

    // Breadcrumb için üst alt-kategori (level=1) ve kök kategori (level=0) adlarını getir
    const subCategoryIds = Array.from(
      new Set(items.map((c) => c.parentId).filter((id): id is string => !!id))
    );
    const subCategories = subCategoryIds.length
      ? await prisma.category.findMany({
          where: { id: { in: subCategoryIds } },
          select: { id: true, name: true, parentId: true },
        })
      : [];
    const subCategoryById = new Map(subCategories.map((s) => [s.id, s]));
    const categoryNameById = await this.getCategoryNameMap(
      Array.from(new Set(subCategories.map((s) => s.parentId).filter((id): id is string => !!id)))
    );

    return {
      items: items.map((c) => {
        const sub = c.parentId ? subCategoryById.get(c.parentId) : undefined;
        return {
          productGroupId: c.id,
          name: c.name,
          image: resolveMediaUrl(c.thumbnail),
          subCategoryId: c.parentId || '',
          subCategoryName: sub?.name,
          categoryName: sub?.parentId ? categoryNameById.get(sub.parentId) : undefined,
        };
      }),
      pagination: { cursor: nextCursor, hasMore, limit },
    };
  }

  /**
   * Popüler subcategories - en fazla post içeren level=1 kategoriler
   */
  async getPopularSubCategories(limit: number = 10): Promise<{
    items: SubCategoryItem[];
    pagination: { hasMore: boolean; limit: number };
  }> {
    const safeLimit = limit > 0 ? Math.min(limit, 50) : 10;

    const postCounts = await prisma.contentPost.groupBy({
      by: ['categoryId'],
      _count: { id: true },
      where: { categoryId: { not: null } },
      orderBy: { _count: { id: 'desc' } },
      take: safeLimit * 5,
    });

    const orderedIds = postCounts
      .map((r) => r.categoryId)
      .filter((id): id is string => id !== null);

    if (orderedIds.length === 0) {
      const fallback = await prisma.category.findMany({
        where: { level: 1 },
        select: { id: true, name: true, thumbnail: true, parentId: true },
        take: safeLimit,
      });
      return {
        items: fallback.map((c) => ({
          subCategoryId: c.id,
          name: c.name,
          image: resolveMediaUrl(c.thumbnail),
          categoryId: c.parentId || '',
        })),
        pagination: { hasMore: false, limit: safeLimit },
      };
    }

    const cats = await prisma.category.findMany({
      where: { id: { in: orderedIds }, level: 1 },
      select: { id: true, name: true, thumbnail: true, parentId: true },
    });

    const catMap = new Map(cats.map((c) => [c.id, c]));
    const ordered = orderedIds
      .filter((id) => catMap.has(id))
      .map((id) => catMap.get(id)!)
      .slice(0, safeLimit);

    return {
      items: ordered.map((c) => ({
        subCategoryId: c.id,
        name: c.name,
        image: resolveMediaUrl(c.thumbnail),
        categoryId: c.parentId || '',
      })),
      pagination: { hasMore: false, limit: safeLimit },
    };
  }

  /**
   * Popüler product groups - en fazla post içeren level=2 kategoriler
   */
  async getPopularProductGroups(limit: number = 10): Promise<{
    items: ProductGroupItem[];
    pagination: { hasMore: boolean; limit: number };
  }> {
    const safeLimit = limit > 0 ? Math.min(limit, 50) : 10;

    const postCounts = await prisma.contentPost.groupBy({
      by: ['categoryId'],
      _count: { id: true },
      where: { categoryId: { not: null } },
      orderBy: { _count: { id: 'desc' } },
      take: safeLimit * 5,
    });

    const orderedIds = postCounts
      .map((r) => r.categoryId)
      .filter((id): id is string => id !== null);

    if (orderedIds.length === 0) {
      const fallback = await prisma.category.findMany({
        where: { level: 2 },
        select: { id: true, name: true, thumbnail: true, parentId: true },
        take: safeLimit,
      });
      return {
        items: fallback.map((c) => ({
          productGroupId: c.id,
          name: c.name,
          image: resolveMediaUrl(c.thumbnail),
          subCategoryId: c.parentId || '',
        })),
        pagination: { hasMore: false, limit: safeLimit },
      };
    }

    const cats = await prisma.category.findMany({
      where: { id: { in: orderedIds }, level: 2 },
      select: { id: true, name: true, thumbnail: true, parentId: true },
    });

    const catMap = new Map(cats.map((c) => [c.id, c]));
    const ordered = orderedIds
      .filter((id) => catMap.has(id))
      .map((id) => catMap.get(id)!)
      .slice(0, safeLimit);

    return {
      items: ordered.map((c) => ({
        productGroupId: c.id,
        name: c.name,
        image: resolveMediaUrl(c.thumbnail),
        subCategoryId: c.parentId || '',
      })),
      pagination: { hasMore: false, limit: safeLimit },
    };
  }

  /**
   * Global product search - Tüm product group'lar arasında arama
   * Sonuçları product group bazında gruplar
   */
  async searchProductsGlobally(
    search: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<{
    items: Array<{
      productGroupId: string;
      productGroupName: string;
      productGroupImage: string | null;
      subCategoryId: string;
      subCategoryName: string;
      categoryId: string;
      categoryName: string;
      products: Array<{
        productId: string;
        name: string;
        image: string | null;
        productGroupId: string;
        subCategoryId: string;
      }>;
    }>;
    pagination: {
      cursor?: string;
      hasMore: boolean;
      limit: number;
    };
  }> {
    const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
    const cursor = options?.cursor;
    const searchTrimmed = search?.trim();

    if (!searchTrimmed || searchTrimmed.length === 0) {
      return {
        items: [],
        pagination: {
          cursor: undefined,
          hasMore: false,
          limit,
        },
      };
    }

    try {
      // Önce arama terimiyle eşleşen product'ları bul
      // ⚠️ KRİTİK: Sadece product name, description ve brand name'de arama yapılmalı
      // Product group veya kategori adı ile eşleşme YAPILMAMALI
      const matchingProducts = await prisma.product.findMany({
        where: {
          // Sadece ürün adı, açıklama ve marka adında arama
          OR: [
            { name: { contains: searchTrimmed, mode: 'insensitive' } },
            { description: { contains: searchTrimmed, mode: 'insensitive' } },
            { brand: { name: { contains: searchTrimmed, mode: 'insensitive' } } },
          ],
          // ⚠️ KRİTİK: Sadece groupId'si olan product'ları al (group'u olmayan product'ları atla)
          groupId: { not: null },
        },
        include: {
          brand: {
            select: {
              name: true,
            },
          },
          group: {
            include: {
              subCategory: {
                include: {
                  mainCategory: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // ⚠️ KRİTİK: Aynı productId'ye sahip ürünlerin birden fazla group'ta görünmesini engelle
      // Her productId sadece bir kez eklenmeli (kendi group'unda)
      const processedProductIds = new Set<string>();
      
      // Product'ları product group bazında grupla
      const productGroupsMap = new Map<
        string,
        {
          productGroupId: string;
          productGroupName: string;
          productGroupImage: string | null;
          subCategoryId: string;
          subCategoryName: string;
          categoryId: string;
          categoryName: string;
          products: Array<{
            productId: string;
            name: string;
            image: string | null;
            productGroupId: string;
            subCategoryId: string;
          }>;
        }
      >();

      for (const product of matchingProducts) {
        // ⚠️ KRİTİK: Group'u olmayan product'ları atla
        if (!product.group) continue;

        // ⚠️ KRİTİK: Bu productId daha önce işlendiyse atla (aynı ürün farklı gruplarda görünmemeli)
        if (processedProductIds.has(product.id)) {
          logger.warn(`Product ${product.id} already processed, skipping duplicate`);
          continue;
        }

        const groupId = product.group.id;
        const subCategory = product.group.subCategory;
        const mainCategory = subCategory?.mainCategory;

        // ⚠️ KRİTİK: Product'ın groupId'si ile eşleşmeli
        if (product.groupId !== groupId) {
          logger.warn(`Product ${product.id} groupId mismatch: ${product.groupId} vs ${groupId}`);
          continue;
        }

        if (!productGroupsMap.has(groupId)) {
          productGroupsMap.set(groupId, {
            productGroupId: groupId,
            productGroupName: product.group.name,
            productGroupImage: resolveMediaUrl(product.group.imageUrl),
            subCategoryId: subCategory?.id || '',
            subCategoryName: subCategory?.name || '',
            categoryId: mainCategory?.id || '',
            categoryName: mainCategory?.name || '',
            products: [],
          });
        }

        // ⚠️ KRİTİK: Ürün görseli doğruluğu - image URL validation
        const productImageUrl = product.imageUrl;
        const resolvedImage = productImageUrl 
          ? resolveMediaUrl(productImageUrl) 
          : null;

        // Image URL validation: null, boş string veya geçersiz URL kontrolü
        const validImage = resolvedImage && 
          resolvedImage.trim().length > 0 && 
          (resolvedImage.startsWith('http://') || resolvedImage.startsWith('https://'));

        const groupData = productGroupsMap.get(groupId)!;
        groupData.products.push({
          productId: product.id,
          name: product.name,
          image: validImage ? resolvedImage : null, // Geçersiz URL'ler null olarak döndürülür
          productGroupId: groupId,
          subCategoryId: subCategory?.id || '',
        });

        // ProductId'yi işlenmiş olarak işaretle
        processedProductIds.add(product.id);
      }

      // ⚠️ KRİTİK: Sadece eşleşen ürünü olan product group'ları döndür
      // Boş product listesi olan group'ları filtrele
      let allGroups = Array.from(productGroupsMap.values())
        .filter((group) => group.products.length > 0); // En az bir ürünü olan group'lar

      // Cursor-based pagination: cursor varsa, o ID'den sonraki group'ları al
      if (cursor) {
        const cursorIndex = allGroups.findIndex((g) => g.productGroupId === cursor);
        if (cursorIndex >= 0) {
          allGroups = allGroups.slice(cursorIndex + 1);
        } else {
          // Cursor bulunamazsa, cursor ID'sinden büyük olanları al
          allGroups = allGroups.filter((g) => g.productGroupId > cursor);
        }
      }

      // Product group'ları ID'ye göre sırala (cursor-based pagination için)
      allGroups.sort((a, b) => a.productGroupId.localeCompare(b.productGroupId));

      // Limit + 1 al ki hasMore'u kontrol edebilelim
      const hasMore = allGroups.length > limit;
      const resultGroups = hasMore ? allGroups.slice(0, limit) : allGroups;
      const nextCursor = hasMore && resultGroups.length > 0 
        ? resultGroups[resultGroups.length - 1].productGroupId 
        : undefined;

      return {
        items: resultGroups,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error(`Failed to search products globally:`, error);
      throw error;
    }
  }
}

