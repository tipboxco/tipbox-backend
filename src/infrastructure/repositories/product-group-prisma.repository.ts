import { ProductGroup } from '../../domain/product/product-group.entity';
import { getPrisma } from './prisma.client';

export class ProductGroupPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<ProductGroup | null> {
    const group = await this.prisma.productGroup.findUnique({ 
      where: { id },
      include: {
        products: true
      }
    });
    return group ? this.toDomain(group) : null;
  }

  async findByName(name: string): Promise<ProductGroup | null> {
    const group = await this.prisma.productGroup.findFirst({ 
      where: { name },
      include: {
        products: true
      }
    });
    return group ? this.toDomain(group) : null;
  }

  async findBySlug(slug: string): Promise<ProductGroup | null> {
    const group = await this.prisma.productGroup.findFirst({ 
      where: { name: slug },
      include: {
        products: true
      }
    });
    return group ? this.toDomain(group) : null;
  }

  async create(subCategoryId: string, name: string, description?: string): Promise<ProductGroup> {
    const group = await this.prisma.productGroup.create({
      data: {
        subCategoryId,
        name,
        description
      },
      include: {
        products: true
      }
    });
    return this.toDomain(group);
  }

  async update(id: string, data: { name?: string; description?: string; slug?: string }): Promise<ProductGroup | null> {
    const group = await this.prisma.productGroup.update({
      where: { id },
      data,
      include: {
        products: true
      }
    });
    return group ? this.toDomain(group) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.productGroup.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<ProductGroup[]> {
    const groups = await this.prisma.productGroup.findMany({
      include: {
        products: true
      },
      orderBy: { name: 'asc' }
    });
    return groups.map(group => this.toDomain(group));
  }

  async listWithProductCounts(): Promise<ProductGroup[]> {
    const groups = await this.prisma.productGroup.findMany({
      include: {
        _count: {
          select: { products: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    return groups.map(group => this.toDomain(group));
  }

  private toDomain(prismaGroup: any): ProductGroup {
    return new ProductGroup(
      prismaGroup.id,
      prismaGroup.subCategoryId,
      prismaGroup.name,
      prismaGroup.description,
      prismaGroup.createdAt,
      prismaGroup.updatedAt
    );
  }
}