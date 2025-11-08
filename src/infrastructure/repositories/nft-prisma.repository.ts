import { getPrisma } from './prisma.client';
import { NFT } from '../../domain/crypto/nft.entity';
import { NFTType } from '../../domain/crypto/nft-type.enum';
import { NFTRarity } from '../../domain/crypto/nft-rarity.enum';

export interface FindNFTsFilter {
  search?: string;
  type?: NFTType;
  rarity?: NFTRarity;
  ownerId?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  offset?: number;
}

export class NFTPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<NFT | null> {
    const nft = await this.prisma.nFT.findUnique({
      where: { id },
    });
    return nft ? this.toDomain(nft) : null;
  }

  async findByOwnerId(ownerId: string, limit?: number, offset?: number): Promise<NFT[]> {
    // Prisma client type'ları henüz currentOwnerId'yi tanımıyor, raw query ile çözüyoruz
    let query = `SELECT * FROM nfts WHERE current_owner_id = $1::uuid ORDER BY created_at DESC`;
    const params: any[] = [ownerId];
    
    if (limit !== undefined) {
      query += ` LIMIT $2`;
      params.push(limit);
      if (offset !== undefined) {
        query += ` OFFSET $3`;
        params.push(offset);
      }
    }
    
    const nfts = await this.prisma.$queryRawUnsafe<Array<{
      id: string;
      name: string;
      description: string | null;
      image_url: string;
      type: string;
      rarity: string;
      is_transferable: boolean;
      current_owner_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>>(query, ...params);
    
    return nfts.map((nft) => this.toDomain({
      id: nft.id,
      name: nft.name,
      description: nft.description,
      imageUrl: nft.image_url,
      type: nft.type,
      rarity: nft.rarity,
      isTransferable: nft.is_transferable,
      currentOwnerId: nft.current_owner_id,
      createdAt: nft.created_at,
      updatedAt: nft.updated_at,
    }));
  }

  async findMany(filter: FindNFTsFilter = {}): Promise<NFT[]> {
    const where: any = {};

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter.type) {
      where.type = filter.type;
    }

    if (filter.rarity) {
      where.rarity = filter.rarity;
    }

    if (filter.ownerId) {
      // Owner filtresi için ayrı bir query - Prisma client henüz currentOwnerId'yi tanımıyor
      const conditions: string[] = ['current_owner_id = $1::uuid'];
      const params: any[] = [filter.ownerId];
      let paramIndex = 2;

      if (filter.search) {
        conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
        params.push(`%${filter.search}%`);
        paramIndex++;
      }

      if (filter.type) {
        conditions.push(`type = $${paramIndex}`);
        params.push(filter.type);
        paramIndex++;
      }

      if (filter.rarity) {
        conditions.push(`rarity = $${paramIndex}`);
        params.push(filter.rarity);
        paramIndex++;
      }

      const limit = filter.limit || 100;
      const offset = filter.offset || 0;
      
      const limitParam = `$${paramIndex}`;
      params.push(limit);
      paramIndex++;
      const offsetParam = `$${paramIndex}`;
      params.push(offset);

      const ownerNfts = await this.prisma.$queryRawUnsafe<Array<{
        id: string;
        name: string;
        description: string | null;
        image_url: string;
        type: string;
        rarity: string;
        is_transferable: boolean;
        current_owner_id: string | null;
        created_at: Date;
        updated_at: Date;
      }>>(
        `SELECT * FROM nfts WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
        ...params
      );
      
      return ownerNfts.map((nft) => this.toDomain({
        id: nft.id,
        name: nft.name,
        description: nft.description,
        imageUrl: nft.image_url,
        type: nft.type,
        rarity: nft.rarity,
        isTransferable: nft.is_transferable,
        currentOwnerId: nft.current_owner_id,
        createdAt: nft.created_at,
        updatedAt: nft.updated_at,
      }));
    }

    const nfts = await this.prisma.nFT.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filter.limit || 100,
      skip: filter.offset || 0,
    });

    return nfts.map((nft) => this.toDomain(nft));
  }

  async updateCurrentOwner(nftId: string, ownerId: string | null): Promise<NFT | null> {
    // Prisma client type'ları henüz currentOwnerId'yi tanımıyor, raw query ile çözüyoruz
    if (ownerId === null) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE nfts SET current_owner_id = NULL, updated_at = NOW() WHERE id = $1::uuid`,
        nftId
      );
    } else {
      await this.prisma.$executeRawUnsafe(
        `UPDATE nfts SET current_owner_id = $1::uuid, updated_at = NOW() WHERE id = $2::uuid`,
        ownerId,
        nftId
      );
    }
    
    return this.findById(nftId);
  }

  private toDomain(prismaNFT: any): NFT {
    return new NFT(
      prismaNFT.id,
      prismaNFT.name,
      prismaNFT.description,
      prismaNFT.imageUrl,
      prismaNFT.type as NFTType,
      prismaNFT.rarity as NFTRarity,
      prismaNFT.isTransferable,
      prismaNFT.currentOwnerId,
      prismaNFT.createdAt,
      prismaNFT.updatedAt
    );
  }
}

