import { PrismaClient } from '@prisma/client';
import logger from '../../infrastructure/logger/logger';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import { withCache } from '../../infrastructure/cache/cache-wrapper.helper';
import { CACHE_KEYS } from '../../infrastructure/cache/cache-keys';
import { CACHE_TTL } from '../../infrastructure/cache/cache-ttl';

const prisma = new PrismaClient();

export interface CategoryItem {
  categoryId: string;
  name: string;
  image: string | null;
}

export interface SubCategoryItem {
  subCategoryId: string;
  name: string;
  image: string | null;
  categoryId: string;
}

export interface ProductGroupItem {
  productGroupId: string;
  name: string;
  image: string | null;
  subCategoryId: string;
}

export interface ProductItem {
  productId: string;
  name: string;
  image: string | null;
  productGroupId: string;
}

export class CatalogService {
  /**
   * Tüm kategorileri listele
   */
  async getAllCategories(): Promise<CategoryItem[]> {
    return withCache(
      CACHE_KEYS.STATIC_CATEGORIES(),
      async () => {
        const categories = await prisma.mainCategory.findMany({
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
          orderBy: {
            name: 'asc',
          },
        });

        const { resolveMediaUrl } = await import('../../infrastructure/config/media.config');

        return categories.map((category) => {
          const imageUrl = resolveMediaUrl(category.imageUrl);

          return {
            categoryId: category.id,
            name: category.name,
            image: imageUrl,
          };
        });
      },
      CACHE_TTL.STATIC_CATEGORIES, // 24 saat - kategoriler çok nadir değişir
      { logPrefix: 'CatalogService' }
    );
  }

  /**
   * Kategoriye göre sub-kategorileri listele
   */
  async getSubCategoriesByCategoryId(categoryId: string): Promise<SubCategoryItem[]> {
    return withCache(
      CACHE_KEYS.CATEGORY(categoryId),
      async () => this.fetchSubCategories(categoryId),
      CACHE_TTL.CATEGORY, // 2 saat
      { logPrefix: 'CatalogService' }
    );
  }

  private async fetchSubCategories(categoryId: string): Promise<SubCategoryItem[]> {
    try {
      const subCategories = await prisma.subCategory.findMany({
        where: {
          mainCategoryId: categoryId,
        },
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return subCategories.map((subCategory) => {
        const imageUrl = resolveMediaUrl(subCategory.imageUrl);

        return {
          subCategoryId: subCategory.id,
          categoryId: categoryId,
          name: subCategory.name,
          image: imageUrl,
        };
      });
    } catch (error) {
      logger.error(`Failed to get sub-categories for category ${categoryId}:`, error);
      throw error;
    }
  }

  /**
   * Sub-kategoriye göre product group'ları listele
   */
  async getProductGroupsBySubCategoryId(subCategoryId: string): Promise<ProductGroupItem[]> {
    return withCache(
      CACHE_KEYS.SUB_CATEGORY(subCategoryId),
      async () => this.fetchProductGroups(subCategoryId),
      CACHE_TTL.SUB_CATEGORY, // 2 saat
      { logPrefix: 'CatalogService' }
    );
  }

  private async fetchProductGroups(subCategoryId: string): Promise<ProductGroupItem[]> {
    try {
      const productGroups = await prisma.productGroup.findMany({
        where: {
          subCategoryId: subCategoryId,
        },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          subCategoryId: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return productGroups.map((group) => {
        const imageUrl = resolveMediaUrl(group.imageUrl);

        return {
          productGroupId: group.id,
          name: group.name,
          image: imageUrl,
          subCategoryId: group.subCategoryId,
        };
      });
    } catch (error) {
      logger.error(`Failed to get product groups for sub-category ${subCategoryId}:`, error);
      throw error;
    }
  }

  /**
   * Product group'a göre ürünleri listele
   */
  async getProductsByProductGroupId(productGroupId: string): Promise<ProductItem[]> {
    return withCache(
      `product-group:${productGroupId}:products`,
      async () => this.fetchProducts(productGroupId),
      CACHE_TTL.CATEGORY_PRODUCTS, // 1 saat
      { logPrefix: 'CatalogService' }
    );
  }

  private async fetchProducts(productGroupId: string): Promise<ProductItem[]> {
    try {
      const products = await prisma.product.findMany({
        where: {
          groupId: productGroupId,
        },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          groupId: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return products.map((product) => {
        const imageUrl = resolveMediaUrl(product.imageUrl);

        return {
          productId: product.id,
          name: product.name,
          image: imageUrl,
          productGroupId: product.groupId || '',
        };
      });
    } catch (error) {
      logger.error(`Failed to get products for product group ${productGroupId}:`, error);
      throw error;
    }
  }
}

