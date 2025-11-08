import { PrismaClient } from '@prisma/client';
import { MainCategory } from '../../domain/product/main-category.entity';

export class MainCategoryPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<MainCategory | null> {
    const category = await this.prisma.mainCategory.findUnique({ 
      where: { id },
      include: {
        subCategories: true
      }
    });
    return category ? this.toDomain(category) : null;
  }

  async findByName(name: string): Promise<MainCategory | null> {
    const category = await this.prisma.mainCategory.findFirst({ 
      where: { name },
      include: {
        subCategories: true
      }
    });
    return category ? this.toDomain(category) : null;
  }



  async create(name: string, description?: string): Promise<MainCategory> {
    const category = await this.prisma.mainCategory.create({
      data: {
        name,
        description
      },
      include: {
        subCategories: true
      }
    });
    return this.toDomain(category);
  }

  async update(id: number, data: { name?: string; description?: string }): Promise<MainCategory | null> {
    const category = await this.prisma.mainCategory.update({
      where: { id },
      data,
      include: {
        subCategories: true
      }
    });
    return category ? this.toDomain(category) : null;
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.mainCategory.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<MainCategory[]> {
    const categories = await this.prisma.mainCategory.findMany({
      include: {
        subCategories: true
      },
      orderBy: { name: 'asc' }
    });
    return categories.map(category => this.toDomain(category));
  }

  async listWithCounts(): Promise<MainCategory[]> {
    const categories = await this.prisma.mainCategory.findMany({
      include: {
        subCategories: {
          include: {
            _count: {
              select: { productGroups: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    return categories.map(category => this.toDomain(category));
  }

  private toDomain(prismaCategory: any): MainCategory {
    return new MainCategory(
      prismaCategory.id,
      prismaCategory.name,
      prismaCategory.description,
      prismaCategory.createdAt,
      prismaCategory.updatedAt
    );
  }
}