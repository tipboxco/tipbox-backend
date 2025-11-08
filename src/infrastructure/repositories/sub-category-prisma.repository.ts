import { PrismaClient } from '@prisma/client';
import { SubCategory } from '../../domain/product/sub-category.entity';

export class SubCategoryPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<SubCategory | null> {
    const category = await this.prisma.subCategory.findUnique({ 
      where: { id },
      include: {
        mainCategory: true,
        productGroups: true,
        contentPosts: true
      }
    });
    return category ? this.toDomain(category) : null;
  }

  async findByName(name: string): Promise<SubCategory | null> {
    const category = await this.prisma.subCategory.findFirst({ 
      where: { name },
      include: {
        mainCategory: true,
        productGroups: true,
        contentPosts: true
      }
    });
    return category ? this.toDomain(category) : null;
  }

  async findByMainCategoryId(mainCategoryId: number): Promise<SubCategory[]> {
    const categories = await this.prisma.subCategory.findMany({
      where: { mainCategoryId },
      include: {
        mainCategory: true,
        productGroups: true,
        contentPosts: true
      },
      orderBy: { name: 'asc' }
    });
    return categories.map(category => this.toDomain(category));
  }

  async create(mainCategoryId: number, name: string, description?: string): Promise<SubCategory> {
    const category = await this.prisma.subCategory.create({
      data: {
        mainCategoryId,
        name,
        description
      },
      include: {
        mainCategory: true,
        productGroups: true,
        contentPosts: true
      }
    });
    return this.toDomain(category);
  }

  async update(id: number, data: { name?: string; description?: string }): Promise<SubCategory | null> {
    const category = await this.prisma.subCategory.update({
      where: { id },
      data,
      include: {
        mainCategory: true,
        productGroups: true,
        contentPosts: true
      }
    });
    return category ? this.toDomain(category) : null;
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.subCategory.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<SubCategory[]> {
    const categories = await this.prisma.subCategory.findMany({
      include: {
        mainCategory: true,
        productGroups: true,
        contentPosts: true
      },
      orderBy: { name: 'asc' }
    });
    return categories.map(category => this.toDomain(category));
  }

  async listWithCounts(): Promise<SubCategory[]> {
    const categories = await this.prisma.subCategory.findMany({
      include: {
        mainCategory: true,
        _count: {
          select: { 
            productGroups: true,
            contentPosts: true 
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    return categories.map(category => this.toDomain(category));
  }

  private toDomain(prismaCategory: any): SubCategory {
    return new SubCategory(
      prismaCategory.id,
      prismaCategory.mainCategoryId,
      prismaCategory.name,
      prismaCategory.description,
      prismaCategory.createdAt,
      prismaCategory.updatedAt
    );
  }
}