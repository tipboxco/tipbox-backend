import { MarketplaceBanner } from '../../domain/marketplace/marketplace-banner.entity';
import { getPrisma } from './prisma.client';

export class MarketplaceBannerPrismaRepository {
  private prisma = getPrisma();

  async findActive(): Promise<MarketplaceBanner[]> {
    const now = new Date();
    const banners = await this.prisma.marketplaceBanner.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: null },
          { startDate: null, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: { gte: now } },
        ],
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    return banners.map((banner) =>
      MarketplaceBanner.create({
        id: banner.id,
        title: banner.title,
        description: banner.description,
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl,
        isActive: banner.isActive,
        displayOrder: banner.displayOrder,
        startDate: banner.startDate,
        endDate: banner.endDate,
        createdAt: banner.createdAt,
        updatedAt: banner.updatedAt,
      })
    );
  }

  async findAll(): Promise<MarketplaceBanner[]> {
    const banners = await this.prisma.marketplaceBanner.findMany({
      orderBy: {
        displayOrder: 'asc',
      },
    });

    return banners.map((banner) =>
      MarketplaceBanner.create({
        id: banner.id,
        title: banner.title,
        description: banner.description,
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl,
        isActive: banner.isActive,
        displayOrder: banner.displayOrder,
        startDate: banner.startDate,
        endDate: banner.endDate,
        createdAt: banner.createdAt,
        updatedAt: banner.updatedAt,
      })
    );
  }

  async findById(id: string): Promise<MarketplaceBanner | null> {
    const banner = await this.prisma.marketplaceBanner.findUnique({
      where: { id },
    });

    if (!banner) return null;

    return MarketplaceBanner.create({
      id: banner.id,
      title: banner.title,
      description: banner.description,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl,
      isActive: banner.isActive,
      displayOrder: banner.displayOrder,
      startDate: banner.startDate,
      endDate: banner.endDate,
      createdAt: banner.createdAt,
      updatedAt: banner.updatedAt,
    });
  }

  async create(data: {
    title: string;
    description?: string;
    imageUrl: string;
    linkUrl?: string;
    isActive?: boolean;
    displayOrder: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<MarketplaceBanner> {
    const banner = await this.prisma.marketplaceBanner.create({
      data: {
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        linkUrl: data.linkUrl,
        isActive: data.isActive ?? true,
        displayOrder: data.displayOrder,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    });

    return MarketplaceBanner.create({
      id: banner.id,
      title: banner.title,
      description: banner.description,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl,
      isActive: banner.isActive,
      displayOrder: banner.displayOrder,
      startDate: banner.startDate,
      endDate: banner.endDate,
      createdAt: banner.createdAt,
      updatedAt: banner.updatedAt,
    });
  }
}
