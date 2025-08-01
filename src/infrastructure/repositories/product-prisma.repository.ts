import { PrismaClient } from '@prisma/client';
import { Product } from '../../domain/product/product.entity';

export class ProductPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({ 
      where: { id },
      include: {
        group: true,

        inventories: true,

      }
    });
    return product ? this.toDomain(product) : null;
  }

  async findByName(name: string): Promise<Product | null> {
    const product = await this.prisma.product.findFirst({ 
      where: { name: { contains: name, mode: 'insensitive' } },
      include: {
        group: true,

        inventories: true,

      }
    });
    return product ? this.toDomain(product) : null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const product = await this.prisma.product.findFirst({ 
      where: { name: { contains: slug, mode: 'insensitive' } },
      include: {
        group: true,

        inventories: true,

      }
    });
    return product ? this.toDomain(product) : null;
  }

  async findByGroupId(groupId: number): Promise<Product[]> {
    const products = await this.prisma.product.findMany({
      where: { groupId },
      include: {
        group: true,
        inventories: true
      },
      orderBy: { name: 'asc' }
    });
    return products.map(product => this.toDomain(product));
  }

  async search(query: string): Promise<Product[]> {
    const products = await this.prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { brand: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        group: true,

        inventories: true,

      },
      orderBy: { name: 'asc' }
    });
    return products.map(product => this.toDomain(product));
  }

  async create(
    name: string, 
    brand?: string,
    description?: string, 
    groupId?: number
  ): Promise<Product> {
    const product = await this.prisma.product.create({
      data: {
        name,
        brand,
        description,
        groupId
      },
      include: {
        group: true,

        inventories: true,

      }
    });
    return this.toDomain(product);
  }

  async update(id: number, data: { 
    name?: string; 
    brand?: string;
    description?: string; 
    groupId?: number;
  }): Promise<Product | null> {
    const product = await this.prisma.product.update({
      where: { id },
      data,
      include: {
        group: true,

        inventories: true,

      }
    });
    return product ? this.toDomain(product) : null;
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.product.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<Product[]> {
    const products = await this.prisma.product.findMany({
      include: {
        group: true,

        inventories: true,

      },
      orderBy: { name: 'asc' }
    });
    return products.map(product => this.toDomain(product));
  }

  async listPopular(limit: number = 10): Promise<Product[]> {
    const products = await this.prisma.product.findMany({
      include: {
        group: true,

        _count: {
          select: { inventories: true }
        }
      },
      orderBy: {
        inventories: {
          _count: 'desc'
        }
      },
      take: limit
    });
    return products.map(product => this.toDomain(product));
  }

  private toDomain(prismaProduct: any): Product {
    return new Product(
      prismaProduct.id,
      prismaProduct.name,
      prismaProduct.brand,
      prismaProduct.description,
      prismaProduct.groupId,
      prismaProduct.createdAt,
      prismaProduct.updatedAt
    );
  }
}