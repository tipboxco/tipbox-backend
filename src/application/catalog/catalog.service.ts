import { PrismaClient } from '@prisma/client';
import logger from '../../infrastructure/logger/logger';
import { getPublicMediaBaseUrl } from '../../infrastructure/config/media.config';

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
    try {
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

      const baseUrl = getPublicMediaBaseUrl();

      return categories.map((category) => {
        let imageUrl: string | null = null;
        
        if (category.imageUrl) {
          // Eğer zaten tam URL ise olduğu gibi kullan
          if (category.imageUrl.startsWith('http://') || category.imageUrl.startsWith('https://')) {
            imageUrl = category.imageUrl;
          } else {
            // Path ise base URL ile birleştir
            imageUrl = `${baseUrl}/${category.imageUrl}`;
          }
        }

        return {
          categoryId: category.id,
          name: category.name,
          image: imageUrl,
        };
      });
    } catch (error) {
      logger.error('Failed to get all categories:', error);
      throw error;
    }
  }

  /**
   * Kategoriye göre sub-kategorileri listele
   */
  async getSubCategoriesByCategoryId(categoryId: string): Promise<SubCategoryItem[]> {
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

      const baseUrl = getPublicMediaBaseUrl();

      return subCategories.map((subCategory) => {
        let imageUrl: string | null = null;
        
        if (subCategory.imageUrl) {
          if (subCategory.imageUrl.startsWith('http://') || subCategory.imageUrl.startsWith('https://')) {
            imageUrl = subCategory.imageUrl;
          } else {
            imageUrl = `${baseUrl}/${subCategory.imageUrl}`;
          }
        }

        return {
          subCategoryId: subCategory.id,
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

      const baseUrl = getPublicMediaBaseUrl();

      return productGroups.map((group) => {
        let imageUrl: string | null = null;
        
        if (group.imageUrl) {
          if (group.imageUrl.startsWith('http://') || group.imageUrl.startsWith('https://')) {
            imageUrl = group.imageUrl;
          } else {
            imageUrl = `${baseUrl}/${group.imageUrl}`;
          }
        }

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

      const baseUrl = getPublicMediaBaseUrl();

      return products.map((product) => {
        let imageUrl: string | null = null;
        
        if (product.imageUrl) {
          if (product.imageUrl.startsWith('http://') || product.imageUrl.startsWith('https://')) {
            imageUrl = product.imageUrl;
          } else {
            imageUrl = `${baseUrl}/${product.imageUrl}`;
          }
        }

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

