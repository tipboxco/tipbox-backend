import type { NFT as PrismaNFTModel, Prisma } from '@prisma/client';
import { getPrisma } from './prisma.client';
import { NFT } from '../../domain/crypto/nft.entity';
import { NFTType } from '../../domain/crypto/nft-type.enum';
import { NFTRarity } from '../../domain/crypto/nft-rarity.enum';

/** Shape accepted by toDomain -- either a full Prisma row or a manually-mapped raw-query result */
interface NFTDomainInput {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  type: string;
  rarity: string;
  isTransferable: boolean;
  currentOwnerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  tokenId?: string | null;
  contractAddress?: string | null;
}

export interface FindNFTsFilter {
  search?: string;
  type?: NFTType;
  rarity?: NFTRarity;
  ownerId?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  cursor?: string;
}

const isUuid = (value?: string) => !!value && /^[0-9a-fA-F-]{36}$/.test(value)

export class NFTPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<NFT | null> {
    const nft = await this.prisma.nFT.findUnique({
      where: { id },
    });
    return nft ? this.toDomain(nft) : null;
  }

  async findByOwnerId(ownerId: string, limit?: number, cursor?: string): Promise<NFT[]> {
    // Prisma client type'ları henüz currentOwnerId'yi tanımıyor, raw query ile çözüyoruz
    const params: (string | number)[] = [ownerId];
    let paramIndex = params.length + 1;

    let cursorFilter = '';
    if (cursor && isUuid(cursor)) {
      cursorFilter = `
        AND (created_at, id) < (
          SELECT created_at, id FROM nfts WHERE id = $${paramIndex}::uuid
        )
      `;
      params.push(cursor);
      paramIndex++;
    }

    const takeLimit = (limit ?? 100) + 1; // +1 hasMore için
    const limitParam = `$${paramIndex}`;
    params.push(takeLimit);

    const query = `
      SELECT * FROM nfts
      WHERE current_owner_id = $1::uuid
      ${cursorFilter}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limitParam}
    `;

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
    const where: Prisma.NFTWhereInput = {};

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
      const params: (string | number)[] = [filter.ownerId];
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

      const limit = (filter.limit || 100) + 1;
      const limitParam = `$${paramIndex}`;
      params.push(limit);
      paramIndex++;

      let cursorFilter = '';
      if (filter.cursor && isUuid(filter.cursor)) {
        cursorFilter = ` AND (created_at, id) < (SELECT created_at, id FROM nfts WHERE id = $${paramIndex}::uuid)`;
        params.push(filter.cursor);
        paramIndex++;
      }

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
        `SELECT * FROM nfts WHERE ${conditions.join(' AND ')}${cursorFilter} ORDER BY created_at DESC, id DESC LIMIT ${limitParam}`,
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
      // Note: Using cursor-based pagination, skip/offset not needed
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

  async incrementViewCount(nftId: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE nfts SET view_count = view_count + 1, updated_at = NOW() WHERE id = $1::uuid`,
      nftId
    );
  }

  async getViewCount(nftId: string): Promise<number> {
    const result = await this.prisma.$queryRawUnsafe<Array<{ view_count: number }>>(
      `SELECT view_count FROM nfts WHERE id = $1::uuid`,
      nftId
    );
    return result[0]?.view_count ?? 0;
  }

  /**
   * Contract'taki tokenId + contractAddress ile NFT bulur (sync için)
   */
  async findByTokenIdAndContract(tokenId: string, contractAddress: string): Promise<NFT | null> {
    const nft = await this.prisma.nFT.findUnique({
      where: {
        tokenId_contractAddress: {
          tokenId,
          contractAddress: contractAddress.toLowerCase(),
        },
      },
    });
    return nft ? this.toDomain(nft) : null;
  }

  /**
   * NFT kaydını günceller (contract sync: metadata + owner)
   */
  async update(id: string, data: {
    name?: string;
    description?: string | null;
    imageUrl?: string;
    type?: NFTType;
    rarity?: NFTRarity;
    currentOwnerId?: string | null;
  }): Promise<NFT | null> {
    const nft = await this.prisma.nFT.update({
      where: { id },
      data: {
        ...(data.name != null && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.imageUrl != null && { imageUrl: data.imageUrl }),
        ...(data.type != null && { type: data.type }),
        ...(data.rarity != null && { rarity: data.rarity }),
        ...(data.currentOwnerId !== undefined && { currentOwnerId: data.currentOwnerId }),
      },
    });
    return this.toDomain(nft);
  }

  /**
   * Yeni NFT kaydı oluşturur (contract sync veya uygulama içi mint için)
   */
  async create(data: {
    name: string;
    description?: string | null;
    imageUrl: string;
    type: NFTType;
    rarity: NFTRarity;
    isTransferable?: boolean;
    currentOwnerId?: string | null;
    tokenId?: string | null;
    contractAddress?: string | null;
  }): Promise<NFT> {
    const nft = await this.prisma.nFT.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        imageUrl: data.imageUrl,
        type: data.type,
        rarity: data.rarity,
        isTransferable: data.isTransferable ?? true,
        currentOwnerId: data.currentOwnerId ?? null,
        tokenId: data.tokenId ?? null,
        contractAddress: data.contractAddress?.toLowerCase() ?? null,
      },
    });
    return this.toDomain(nft);
  }

  private toDomain(prismaNFT: PrismaNFTModel | NFTDomainInput): NFT {
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
      prismaNFT.updatedAt,
      prismaNFT.tokenId ?? null,
      prismaNFT.contractAddress ?? null
    );
  }
}

