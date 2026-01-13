import { ProductExperience } from '../../domain/inventory/product-experience.entity';
import { getPrisma } from './prisma.client';

export class ProductExperiencePrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<ProductExperience | null> {
    const experience = await this.prisma.productExperience.findUnique({ 
      where: { id },
      include: {
        inventory: {
          include: {
            user: true,
            product: true
          }
        }
      }
    });
    return experience ? this.toDomain(experience) : null;
  }

  async findByInventoryId(inventoryId: string): Promise<ProductExperience[]> {
    const experiences = await this.prisma.productExperience.findMany({
      where: { inventoryId },
      include: {
        inventory: {
          include: {
            user: true,
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return experiences.map(experience => this.toDomain(experience));
  }

  async findByTitle(title: string): Promise<ProductExperience[]> {
    const experiences = await this.prisma.productExperience.findMany({
      where: { 
        title: { contains: title, mode: 'insensitive' }
      },
      include: {
        inventory: {
          include: {
            user: true,
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return experiences.map(experience => this.toDomain(experience));
  }

  async searchByText(query: string): Promise<ProductExperience[]> {
    const experiences = await this.prisma.productExperience.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { experienceText: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        inventory: {
          include: {
            user: true,
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return experiences.map(experience => this.toDomain(experience));
  }

  async create(
    inventoryId: string,
    title: string,
    experienceText: string
  ): Promise<ProductExperience> {
    const experience = await this.prisma.productExperience.create({
      data: {
        inventoryId,
        title,
        experienceText
      },
      include: {
        inventory: {
          include: {
            user: true,
            product: true
          }
        }
      }
    });
    return this.toDomain(experience);
  }

  async update(id: string, data: { 
    title?: string;
    experienceText?: string;
  }): Promise<ProductExperience | null> {
    const experience = await this.prisma.productExperience.update({
      where: { id },
      data,
      include: {
        inventory: {
          include: {
            user: true,
            product: true
          }
        }
      }
    });
    return experience ? this.toDomain(experience) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.productExperience.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByInventoryId(inventoryId: string): Promise<boolean> {
    try {
      await this.prisma.productExperience.deleteMany({
        where: { inventoryId }
      });
      return true;
    } catch {
      return false;
    }
  }

  async countByInventoryId(inventoryId: string): Promise<number> {
    return await this.prisma.productExperience.count({
      where: { inventoryId }
    });
  }

  async findRecent(limit: number = 10): Promise<ProductExperience[]> {
    const experiences = await this.prisma.productExperience.findMany({
      include: {
        inventory: {
          include: {
            user: true,
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return experiences.map(experience => this.toDomain(experience));
  }

  async list(): Promise<ProductExperience[]> {
    const experiences = await this.prisma.productExperience.findMany({
      include: {
        inventory: {
          include: {
            user: true,
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return experiences.map(experience => this.toDomain(experience));
  }

  private toDomain(prismaExperience: any): ProductExperience {
    return new ProductExperience(
      prismaExperience.id,
      prismaExperience.inventoryId,
      prismaExperience.title,
      prismaExperience.experienceText,
      prismaExperience.createdAt,
      prismaExperience.updatedAt
    );
  }
}