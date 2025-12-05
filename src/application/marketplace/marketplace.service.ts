import { NFTPrismaRepository } from '../../infrastructure/repositories/nft-prisma.repository';
import { NFTMarketListingPrismaRepository } from '../../infrastructure/repositories/nft-market-listing-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { UserAvatarPrismaRepository } from '../../infrastructure/repositories/user-avatar-prisma.repository';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { NotFoundError, ValidationError } from '../../infrastructure/errors/custom-errors';
import { NFTRarity } from '../../domain/crypto/nft-rarity.enum';
import {
  MarketplaceNFTResponse,
  UserNFTResponse,
  ListMarketplaceNFTsQuery,
  ListUserNFTsQuery,
  CreateListingRequest,
  UpdateListingPriceRequest,
  MarketplaceNFTDetailResponse,
  SellNFT,
  SellNFTDetail,
  RarityType,
} from '../../interfaces/marketplace/marketplace.dto';
import { NFTMarketListingStatus } from '../../domain/crypto/nft-market-listing-status.enum';
import { NFTType } from '../../domain/crypto/nft-type.enum';
import { NFTRarity } from '../../domain/crypto/nft-rarity.enum';
import logger from '../../infrastructure/logger/logger';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';

export class MarketplaceService {
  private readonly nftRepo: NFTPrismaRepository;
  private readonly listingRepo: NFTMarketListingPrismaRepository;
  private readonly profileRepo: ProfilePrismaRepository;
  private readonly avatarRepo: UserAvatarPrismaRepository;

  constructor() {
    this.nftRepo = new NFTPrismaRepository();
    this.listingRepo = new NFTMarketListingPrismaRepository();
    this.profileRepo = new ProfilePrismaRepository();
    this.avatarRepo = new UserAvatarPrismaRepository();
  }

  /**
   * Satışta bulunan NFT'lerin listesini getirir
   */
  async listActiveListings(query: ListMarketplaceNFTsQuery = {}): Promise<MarketplaceNFTResponse[]> {
    try {
      const filter = {
        status: NFTMarketListingStatus.ACTIVE,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        search: query.search,
        nftType: query.type,
        nftRarity: query.rarity,
        orderBy: query.orderBy,
        limit: query.limit || 50,
        offset: query.offset || 0,
      };

      const listings = await this.listingRepo.findActiveListings(filter);

      // NFT ID'lerini topla ve toplu sorgula
      const nftIds = Array.from(new Set(listings.map(l => l.nftId)));
      const nfts = await Promise.all(
        nftIds.map(id => this.nftRepo.findById(id))
      );
      const nftMap = new Map(nfts.filter(n => n).map(n => [n!.id, n!]));

      // User ID'lerini topla ve toplu sorgula
      const userIds = Array.from(new Set(listings.map(l => l.listedByUserId)));
      const [profiles, avatars] = await Promise.all([
        Promise.all(userIds.map(id => this.profileRepo.findByUserId(id))),
        Promise.all(userIds.map(id => this.avatarRepo.findActiveByUserId(id))),
      ]);
      
      const profileMap = new Map(
        profiles.filter(p => p).map((p, i) => [userIds[i], p])
      );
      const avatarMap = new Map(
        avatars.filter(a => a).map((a, i) => [userIds[i], a])
      );

      const results: MarketplaceNFTResponse[] = [];

      for (const listing of listings) {
        const nft = nftMap.get(listing.nftId);
        if (!nft) continue;

        const profile = profileMap.get(listing.listedByUserId);
        const username = profile?.userName || 'Unknown';

        const avatar = avatarMap.get(listing.listedByUserId);
        const userAvatar = avatar?.imageUrl;

        results.push({
          id: listing.id,
          title: nft.name,
          username,
          price: listing.price.toString(),
          image: nft.imageUrl,
          userAvatar: userAvatar || undefined,
        });
      }

      return results;
    } catch (error) {
      logger.error({
        message: 'Error listing marketplace NFTs',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Kullanıcının sahip olduğu NFT'lerin listesini getirir
   */
  async listUserNFTs(userId: string, query: ListUserNFTsQuery = {}): Promise<UserNFTResponse[]> {
    try {
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      const nfts = await this.nftRepo.findByOwnerId(userId, limit, offset);

      // Kullanıcı profilini bir kez al
      const profile = await this.profileRepo.findByUserId(userId);
      const username = profile?.userName || 'Unknown';

      const results: UserNFTResponse[] = nfts.map(nft => ({
        id: nft.id,
        title: nft.name,
        username,
        image: nft.imageUrl,
      }));

      return results;
    } catch (error) {
      logger.error({
        message: 'Error listing user NFTs',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * NFT'yi satışa koyar
   */
  async createListing(userId: string, request: CreateListingRequest): Promise<MarketplaceNFTDetailResponse> {
    try {
      // NFT'nin kullanıcıya ait olduğunu kontrol et
      const nft = await this.nftRepo.findById(request.nftId);
      if (!nft) {
        throw new Error('NFT bulunamadı');
      }

      if (!nft.belongsToUser(userId)) {
        throw new Error('Bu NFT size ait değil');
      }

      // Zaten aktif bir listing var mı kontrol et
      const existingListing = await this.listingRepo.findActiveByNftId(request.nftId);
      if (existingListing) {
        throw new Error('Bu NFT zaten satışta');
      }

      // Listing oluştur
      const listing = await this.listingRepo.create(request.nftId, userId, request.amount);

      // Kullanıcı profilini al
      const profile = await this.profileRepo.findByUserId(userId);
      const username = profile?.userName || 'Unknown';
      
      // Kullanıcı avatarını al
      const avatar = await this.avatarRepo.findActiveByUserId(userId);
      const userAvatar = avatar?.imageUrl;

      return {
        id: listing.id,
        title: nft.name,
        description: nft.description || undefined,
        username,
        price: listing.price.toString(),
        image: nft.imageUrl,
        userAvatar: userAvatar || undefined,
        rarity: nft.getRarityDisplayName(),
        type: nft.getTypeDisplayName(),
        listedAt: listing.listedAt.toISOString(),
        sellerId: userId,
        nftId: nft.id,
      };
    } catch (error) {
      logger.error({
        message: 'Error creating listing',
        userId,
        nftId: request.nftId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Listing fiyatını günceller
   */
  async updateListingPrice(userId: string, listingId: string, request: UpdateListingPriceRequest): Promise<MarketplaceNFTDetailResponse> {
    try {
      // Listing'i al ve kullanıcıya ait olduğunu kontrol et
      const listing = await this.listingRepo.findById(listingId);
      if (!listing) {
        throw new Error('Listing bulunamadı');
      }

      if (!listing.belongsToUser(userId)) {
        throw new Error('Bu listing size ait değil');
      }

      if (!listing.isActive()) {
        throw new Error('Sadece aktif listingler güncellenebilir');
      }

      // Fiyatı güncelle
      const updatedListing = await this.listingRepo.updatePrice(listingId, request.amount);

      if (!updatedListing) {
        throw new Error('Fiyat güncellenemedi');
      }

      // NFT ve profil bilgilerini al
      const nft = await this.nftRepo.findById(updatedListing.nftId);
      if (!nft) {
        throw new Error('NFT bulunamadı');
      }

      const profile = await this.profileRepo.findByUserId(userId);
      const username = profile?.userName || 'Unknown';

      return {
        id: updatedListing.id,
        title: nft.name,
        description: nft.description || undefined,
        username,
        price: updatedListing.price.toString(),
        image: nft.imageUrl,
        rarity: nft.getRarityDisplayName(),
        type: nft.getTypeDisplayName(),
        listedAt: updatedListing.listedAt.toISOString(),
        sellerId: userId,
        nftId: nft.id,
      };
    } catch (error) {
      logger.error({
        message: 'Error updating listing price',
        userId,
        listingId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Listing'i iptal eder (delist)
   */
  async cancelListing(userId: string, listingId: string): Promise<void> {
    try {
      // Listing'i al ve kullanıcıya ait olduğunu kontrol et
      const listing = await this.listingRepo.findById(listingId);
      if (!listing) {
        throw new Error('Listing bulunamadı');
      }

      if (!listing.belongsToUser(userId)) {
        throw new Error('Bu listing size ait değil');
      }

      if (!listing.canBeCancelled()) {
        throw new Error('Bu listing iptal edilemez');
      }

      // Listing'i iptal et
      await this.listingRepo.cancel(listingId);
    } catch (error) {
      logger.error({
        message: 'Error cancelling listing',
        userId,
        listingId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Rarity mapping: COMMON -> usual, RARE -> rare, EPIC -> epic
   */
  private mapRarityToRarityType(rarity: NFTRarity): RarityType {
    switch (rarity) {
      case NFTRarity.COMMON:
        return 'usual';
      case NFTRarity.RARE:
        return 'rare';
      case NFTRarity.EPIC:
        return 'epic';
      default:
        return 'usual';
    }
  }

  /**
   * NFT satış bilgilerini getirir (SellNFT)
   *
   * İş kuralları:
   * - NFT yoksa: 404 NotFoundError
   * - NFT mevcut ama kullanıcıya ait değilse: 400 ValidationError
   * - Diğer hatalar: 500 (global error handler)
   */
  async getSellNFTInfo(userId: string, nftId: string): Promise<SellNFT> {
    try {
      const prisma = getPrisma();

      // NFT'yi bul
      const nft = await this.nftRepo.findById(nftId);
      if (!nft) {
        throw new NotFoundError('NFT bulunamadı');
      }

      // NFT'nin kullanıcıya ait olduğunu kontrol et
      if (!nft.belongsToUser(userId)) {
        throw new ValidationError('Bu NFT size ait değil');
      }

      // Aktif listing var mı kontrol et
      const activeListing = await this.listingRepo.findActiveByNftId(nftId);

      // Viewer sayısı: Transaction sayısı (NFT'yi gören/transfer eden kişi sayısı)
      const viewerCount = await prisma.nFTTransaction.count({
        where: { nftId },
      });

      // Suggested price: Market değeri
      const suggestedPrice = nft.getMarketValue();

      // Current price: Aktif listing varsa listing price, yoksa 0
      const currentPrice = activeListing?.price || 0;

      // Gas fee: Price'ın %5'i (minimum 1 TIPS) - current price kullan
      const priceForGas = currentPrice || suggestedPrice;
      const gasFee = Math.max(1, priceForGas * 0.05);

      // Earnings after sales: Price - gas fee
      const earningsAfterSales = priceForGas - gasFee;

      return {
        id: nft.id,
        viewer: viewerCount,
        rarity: this.mapRarityToRarityType(nft.rarity),
        price: currentPrice,
        suggestedPrice,
        gasFee: Number(gasFee.toFixed(2)),
        earningsAfterSales: Number(earningsAfterSales.toFixed(2)),
      };
    } catch (error) {
      logger.error({
        message: 'Error getting sell NFT info',
        userId,
        nftId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * NFT satış detayını getirir (SellNFTDetail)
   */
  async getSellNFTDetail(userId: string, nftId: string): Promise<SellNFTDetail> {
    try {
      const prisma = getPrisma();

      // NFT'yi bul
      const nft = await this.nftRepo.findById(nftId);
      if (!nft) {
        throw new Error('NFT bulunamadı');
      }

      // NFT'nin kullanıcıya ait olduğunu kontrol et
      if (!nft.belongsToUser(userId)) {
        throw new Error('Bu NFT size ait değil');
      }

      // Aktif listing'i bul (eğer varsa)
      const activeListing = await this.listingRepo.findActiveByNftId(nftId);

      // Viewer sayısı: Transaction sayısı
      const viewerCount = await prisma.nFTTransaction.count({
        where: { nftId },
      });

      // Total owner: Farklı kullanıcı sayısı (toUserId'lerden distinct)
      const uniqueOwners = await prisma.nFTTransaction.findMany({
        where: { nftId },
        select: { toUserId: true },
        distinct: ['toUserId'],
      });
      const totalOwner = uniqueOwners.length;

      // Current price (active listing varsa)
      const price = activeListing?.price || 0;

      // Suggested price: Market değeri
      const suggestedPrice = nft.getMarketValue();

      // Earn date: İlk transaction tarihi (mint date)
      const firstTransaction = await prisma.nFTTransaction.findFirst({
        where: { nftId },
        orderBy: { createdAt: 'asc' },
      });
      const earnDate = firstTransaction?.createdAt.toISOString() || nft.createdAt.toISOString();

      // Owner user bilgisi
      const ownerProfile = await this.profileRepo.findByUserId(userId);
      const ownerName = ownerProfile?.displayName || ownerProfile?.userName || 'Unknown';

      return {
        id: nft.id,
        viewer: viewerCount,
        rarity: this.mapRarityToRarityType(nft.rarity),
        price,
        suggestedPrice,
        earnDate,
        totalOwner,
        ownerUser: {
          id: userId,
          name: ownerName,
        },
      };
    } catch (error) {
      logger.error({
        message: 'Error getting sell NFT detail',
        userId,
        nftId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}


      throw error;
    }
  }
}

