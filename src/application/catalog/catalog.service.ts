import { PrismaClient } from '@prisma/client';
import logger from '../../infrastructure/logger/logger';

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

      return categories.map((category) => ({
        categoryId: category.id,
        name: category.name,
        image: category.imageUrl,
      }));
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
          mainCategoryId: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      return subCategories.map((subCategory) => ({
        subCategoryId: subCategory.id,
        name: subCategory.name,
        image: subCategory.imageUrl,
        categoryId: subCategory.mainCategoryId,
      }));
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

      return productGroups.map((group) => ({
        productGroupId: group.id,
        name: group.name,
        image: group.imageUrl,
        subCategoryId: group.subCategoryId,
      }));
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

      return products.map((product) => ({
        productId: product.id,
        name: product.name,
        image: product.imageUrl,
        productGroupId: product.groupId || '',
      }));
    } catch (error) {
      logger.error(`Failed to get products for product group ${productGroupId}:`, error);
      throw error;
    }
  }
}

