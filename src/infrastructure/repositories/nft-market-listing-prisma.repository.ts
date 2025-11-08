import { getPrisma } from './prisma.client';
import { NFTMarketListing } from '../../domain/crypto/nft-market-listing.entity';
import { NFTMarketListingStatus } from '../../domain/crypto/nft-market-listing-status.enum';

export interface FindListingsFilter {
  nftId?: string;
  listedByUserId?: string;
  status?: NFTMarketListingStatus;
  minPrice?: number;
  maxPrice?: number;
  search?: string; // NFT name veya description'a göre arama
  nftType?: string; // NFT type filtresi
  nftRarity?: string; // NFT rarity filtresi
  limit?: number;
  offset?: number;
  orderBy?: 'price_asc' | 'price_desc' | 'listedAt_desc' | 'listedAt_asc';
}

export class NFTMarketListingPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<NFTMarketListing | null> {
    const listing = await this.prisma.nFTMarketListing.findUnique({
      where: { id },
      include: {
        nft: true,
        listedByUser: {
          include: {
            profile: true,
            avatars: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
    });
    return listing ? this.toDomain(listing) : null;
  }

  async findActiveByNftId(nftId: string): Promise<NFTMarketListing | null> {
    const listing = await this.prisma.nFTMarketListing.findFirst({
      where: {
        nftId,
        status: NFTMarketListingStatus.ACTIVE,
      },
      include: {
        nft: true,
        listedByUser: {
          include: {
            profile: true,
            avatars: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
    });
    return listing ? this.toDomain(listing) : null;
  }

  async findActiveListings(filter: FindListingsFilter = {}): Promise<NFTMarketListing[]> {
    const where: any = {
      status: NFTMarketListingStatus.ACTIVE,
    };

    if (filter.nftId) {
      where.nftId = filter.nftId;
    }

    if (filter.listedByUserId) {
      where.listedByUserId = filter.listedByUserId;
    }

    if (filter.minPrice !== undefined) {
      where.price = { ...where.price, gte: filter.minPrice };
    }

    if (filter.maxPrice !== undefined) {
      where.price = { ...where.price, lte: filter.maxPrice };
    }

    // NFT filtreleri (search, type, rarity)
    const nftFilters: any = {};
    
    if (filter.search) {
      nftFilters.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    
    if (filter.nftType) {
      nftFilters.type = filter.nftType;
    }
    
    if (filter.nftRarity) {
      nftFilters.rarity = filter.nftRarity;
    }
    
    if (Object.keys(nftFilters).length > 0) {
      where.nft = nftFilters;
    }

    const orderBy: any = {};
    if (filter.orderBy) {
      if (filter.orderBy === 'price_asc') {
        orderBy.price = 'asc';
      } else if (filter.orderBy === 'price_desc') {
        orderBy.price = 'desc';
      } else if (filter.orderBy === 'listedAt_desc') {
        orderBy.listedAt = 'desc';
      } else if (filter.orderBy === 'listedAt_asc') {
        orderBy.listedAt = 'asc';
      }
    } else {
      orderBy.listedAt = 'desc'; // Default
    }

    const listings = await this.prisma.nFTMarketListing.findMany({
      where,
      include: {
        nft: true,
        listedByUser: {
          include: {
            profile: true,
            avatars: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
      orderBy,
      take: filter.limit || 100,
      skip: filter.offset || 0,
    });

    return listings.map((listing) => this.toDomain(listing));
  }

  async findByUserId(userId: string, status?: NFTMarketListingStatus): Promise<NFTMarketListing[]> {
    const where: any = { listedByUserId: userId };
    if (status) {
      where.status = status;
    }

    const listings = await this.prisma.nFTMarketListing.findMany({
      where,
      include: {
        nft: true,
        listedByUser: {
          include: {
            profile: true,
            avatars: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { listedAt: 'desc' },
    });

    return listings.map((listing) => this.toDomain(listing));
  }

  async create(
    nftId: string,
    listedByUserId: string,
    price: number
  ): Promise<NFTMarketListing> {
    const listing = await this.prisma.nFTMarketListing.create({
      data: {
        nftId,
        listedByUserId,
        price,
        status: NFTMarketListingStatus.ACTIVE,
      },
      include: {
        nft: true,
        listedByUser: {
          include: {
            profile: true,
            avatars: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
    });
    return this.toDomain(listing);
  }

  async updatePrice(id: string, price: number): Promise<NFTMarketListing | null> {
    const listing = await this.prisma.nFTMarketListing.update({
      where: { id },
      data: { price },
      include: {
        nft: true,
        listedByUser: {
          include: {
            profile: true,
            avatars: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
    });
    return this.toDomain(listing);
  }

  async cancel(id: string): Promise<NFTMarketListing | null> {
    const listing = await this.prisma.nFTMarketListing.update({
      where: { id },
      data: { status: NFTMarketListingStatus.CANCELLED },
      include: {
        nft: true,
        listedByUser: {
          include: {
            profile: true,
            avatars: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
    });
    return this.toDomain(listing);
  }

  async markAsSold(id: string): Promise<NFTMarketListing | null> {
    const listing = await this.prisma.nFTMarketListing.update({
      where: { id },
      data: { status: NFTMarketListingStatus.SOLD },
      include: {
        nft: true,
        listedByUser: {
          include: {
            profile: true,
            avatars: {
              where: { isActive: true },
              take: 1,
            },
          },
        },
      },
    });
    return this.toDomain(listing);
  }

  private toDomain(prismaListing: any): NFTMarketListing {
    return new NFTMarketListing(
      prismaListing.id,
      prismaListing.nftId,
      prismaListing.listedByUserId,
      prismaListing.price,
      prismaListing.status as NFTMarketListingStatus,
      prismaListing.listedAt,
      prismaListing.createdAt,
      prismaListing.updatedAt
    );
  }
}

