import { NFTPrismaRepository } from '../../infrastructure/repositories/nft-prisma.repository';
import { NFTMarketListingPrismaRepository } from '../../infrastructure/repositories/nft-market-listing-prisma.repository';
import { NFTTransactionPrismaRepository } from '../../infrastructure/repositories/nft-transaction-prisma.repository';
import { ProfilePrismaRepository } from '../../infrastructure/repositories/profile-prisma.repository';
import { UserAvatarPrismaRepository } from '../../infrastructure/repositories/user-avatar-prisma.repository';
import { TransactionService } from '../transaction/transaction.service';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../../domain/notification/notification-type.enum';
import { NotFoundError, ValidationError } from '../../infrastructure/errors/custom-errors';
import { NFTRarity } from '../../domain/crypto/nft-rarity.enum';
import { NFTType } from '../../domain/crypto/nft-type.enum';
import { createWeb3NftService, resolveNftImageUrl } from '../wallet/web3-nft-service';
import type { WalletNFTItem } from '../wallet/web3-nft-service/types';
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
  NFTPriceHistory,
  BuyNFTRequest,
  BuyNFTResponse,
} from '../../interfaces/marketplace/marketplace.dto';
import { NFTMarketListingStatus } from '../../domain/crypto/nft-market-listing-status.enum';
import { resolveMediaUrl } from '../../infrastructure/config/media.config';
import logger from '../../infrastructure/logger/logger';
import { 
  invalidateNFTListingCache, 
  invalidateNFTTransactionCache,
  invalidateUserNFTCache,
} from '../../infrastructure/cache/cache-invalidation';

export class MarketplaceService {
  private readonly nftRepo: NFTPrismaRepository;
  private readonly listingRepo: NFTMarketListingPrismaRepository;
  private readonly transactionRepo: NFTTransactionPrismaRepository;
  private readonly profileRepo: ProfilePrismaRepository;
  private readonly avatarRepo: UserAvatarPrismaRepository;
  private readonly transactionService: TransactionService;
  private readonly notificationService: NotificationService;

  constructor() {
    this.nftRepo = new NFTPrismaRepository();
    this.listingRepo = new NFTMarketListingPrismaRepository();
    this.transactionRepo = new NFTTransactionPrismaRepository();
    this.profileRepo = new ProfilePrismaRepository();
    this.avatarRepo = new UserAvatarPrismaRepository();
    this.transactionService = new TransactionService();
    this.notificationService = new NotificationService();
  }

  /**
   * Contract metadata attributes'tan NFT type ve rarity çıkarır
   */
  private parseTypeAndRarityFromMetadata(metadata?: WalletNFTItem['metadata']): { type: NFTType; rarity: NFTRarity } {
    const attrs = metadata?.attributes ?? [];
    const getAttr = (key: string) => {
      const a = attrs.find((x) => String(x.trait_type).toLowerCase() === key);
      return a != null ? String(a.value).toLowerCase() : '';
    };
    const typeVal = getAttr('type');
    const rarityVal = getAttr('rarity');

    let type: NFTType = NFTType.BADGE;
    if (typeVal === 'cosmetic') type = NFTType.COSMETIC;
    else if (typeVal === 'lootbox') type = NFTType.LOOTBOX;

    let rarity: NFTRarity = NFTRarity.COMMON;
    if (rarityVal === 'rare') rarity = NFTRarity.RARE;
    else if (rarityVal === 'epic') rarity = NFTRarity.EPIC;

    return { type, rarity };
  }

  /**
   * Kullanıcının smartAccountWallet adresindeki contract NFT'lerini çekip DB ile senkronize eder.
   * /my-nfts çağrılmadan önce çağrılırsa listede contract'taki güncel sahiplik yansır.
   */
  async syncUserNFTsFromContract(userId: string, smartAccountAddress: string): Promise<{ synced: number; created: number }> {
    const nftService = createWeb3NftService();
    const result = await nftService.getWalletNFTs(smartAccountAddress);
    if (!result.success || !result.nfts.length) {
      return { synced: 0, created: 0 };
    }

    let created = 0;
    const normalizedContract = result.nfts[0]?.contractAddress?.toLowerCase() ?? '';

    for (const item of result.nfts) {
      const tokenId = item.tokenId;
      const contractAddress = item.contractAddress?.toLowerCase() ?? normalizedContract;
      const meta = item.metadata;
      const { type, rarity } = this.parseTypeAndRarityFromMetadata(meta);
      const name = meta?.name?.trim() || `NFT #${tokenId}`;
      const description = meta?.description?.trim() || null;
      const imageUrl = (resolveNftImageUrl(meta) || meta?.image || process.env.SEED_MEDIA_BASE_URL || '').replace(':9000', '')
      .replace(process.env.TUNNEL_URL || '',process.env.SEED_MEDIA_BASE_URL || '');

      const existing = await this.nftRepo.findByTokenIdAndContract(tokenId, contractAddress);
      if (existing) {
        await this.nftRepo.update(existing.id, {
          name,
          description,
          imageUrl,
          type,
          rarity,
          currentOwnerId: userId,
        });
        continue;
      }

      await this.nftRepo.create({
        name,
        description,
        imageUrl,
        type,
        rarity,
        isTransferable: true,
        currentOwnerId: userId,
        tokenId,
        contractAddress,
      });
      created++;
    }

    const synced = result.nfts.length;
    if (synced > 0) {
      await invalidateUserNFTCache(userId);
    }
    logger.info({
      message: 'Contract NFT sync completed',
      userId,
      smartAccountAddress,
      synced,
      created,
    });
    return { synced, created };
  }

  /**
   * Satışta bulunan NFT'lerin listesini getirir
   */
  async listActiveListings(query: ListMarketplaceNFTsQuery = {}): Promise<{
    items: MarketplaceNFTResponse[];
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    try {
      const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 50;
      const filter = {
        status: NFTMarketListingStatus.ACTIVE,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        search: query.search,
        nftType: NFTType.COSMETIC, // Marketplace sadece kozmetik NFT'ler için
        nftRarity: query.rarity,
        orderBy: query.orderBy,
        limit,
        cursor: query.cursor,
      };

      const listings = await this.listingRepo.findActiveListings(filter);
      const hasMore = listings.length > limit;
      const paginated = hasMore ? listings.slice(0, limit) : listings;

      // NFT ID'lerini topla ve toplu sorgula
      const nftIds = Array.from(new Set(paginated.map(l => l.nftId)));
      const nfts = await Promise.all(
        nftIds.map(id => this.nftRepo.findById(id))
      );
      const nftMap = new Map(nfts.filter(n => n).map(n => [n!.id, n!]));

      // User ID'lerini topla ve toplu sorgula
      const userIds = Array.from(new Set(paginated.map(l => l.listedByUserId)));
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

      for (const listing of paginated) {
        const nft = nftMap.get(listing.nftId);
        if (!nft) continue;

        const profile = profileMap.get(listing.listedByUserId);
        const username = profile?.userName || 'Unknown';

        const avatar = avatarMap.get(listing.listedByUserId);
        const userAvatar = resolveMediaUrl(avatar?.imageUrl || null);

        results.push({
          id: listing.id,
          title: nft.name,
          username,
          price: listing.price.toString(),
          image: resolveMediaUrl(nft.imageUrl || null) || '',
          userAvatar: userAvatar || undefined,
        });
      }

      const nextCursor = hasMore && results.length > 0 ? results[results.length - 1].id : undefined;

      return {
        items: results,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
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
  async listUserNFTs(userId: string, query: ListUserNFTsQuery = {}): Promise<{
    items: UserNFTResponse[];
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    try {
      const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 50;
      const allNfts = await this.nftRepo.findByOwnerId(userId, limit + 50, query.cursor);
      // Marketplace sadece kozmetik NFT'ler için
      const cosmeticNfts = allNfts.filter(nft => nft.type === NFTType.COSMETIC);
      const nfts = cosmeticNfts.slice(0, limit + 1);
      const hasMore = nfts.length > limit;
      const paginated = hasMore ? nfts.slice(0, limit) : nfts;

      // Kullanıcı profilini bir kez al
      const profile = await this.profileRepo.findByUserId(userId);
      const username = profile?.userName || 'Unknown';

      // Get all NFT IDs to fetch listings
      const nftIds = paginated.map(nft => nft.id);
      
      // Fetch all listings for these NFTs (active or any status)
      const prisma = getPrisma();
      const listings = await prisma.nFTMarketListing.findMany({
        where: {
          nftId: { in: nftIds },
          listedByUserId: userId,
        },
        orderBy: { listedAt: 'desc' },
      });

      // Create a map of nftId -> listing
      const listingMap = new Map(
        listings.map(listing => [listing.nftId, listing])
      );

      const results: UserNFTResponse[] = paginated.map(nft => {
        const listing = listingMap.get(nft.id);
        return {
          id: nft.id,
          title: nft.name,
          username,
          image: nft.imageUrl,
          description: nft.description || undefined,
          type: nft.type,
          rarity: nft.rarity,
          listing: listing ? {
            id: listing.id,
            price: listing.price,
            listedAt: listing.listedAt.toISOString(),
            status: listing.status as 'ACTIVE' | 'SOLD' | 'CANCELLED',
          } : undefined,
        };
      });

      const nextCursor = hasMore && results.length > 0 ? results[results.length - 1].id : undefined;

      return {
        items: results,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
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

      // Marketplace'te sadece kozmetik NFT'ler listelenebilir
      if (nft.type !== NFTType.COSMETIC) {
        throw new ValidationError('Marketplace\'te sadece kozmetik NFT\'ler listelenebilir');
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
      const userAvatar = resolveMediaUrl(avatar?.imageUrl || null);

      // Send notification asynchronously
      this.notificationService.sendNotification(
        userId,
        NotificationType.NFT_LISTED,
        {
          nftName: nft.name,
          nftId: nft.id,
          price: request.amount,
          listingId: listing.id,
          rarity: nft.getRarityDisplayName(),
          type: nft.getTypeDisplayName(),
        }
      ).catch(error => {
        logger.error('Error sending NFT listed notification:', error);
      });

      // Invalidate cache (async, don't wait)
      invalidateNFTListingCache({
        nftId: nft.id,
        userId,
      }).catch(error => {
        logger.error('Error invalidating NFT listing cache:', error);
      });

      return {
        id: listing.id,
        title: nft.name,
        description: nft.description || undefined,
        username,
        price: listing.price.toString(),
        image: resolveMediaUrl(nft.imageUrl) || nft.imageUrl,
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
      const avatar = await this.avatarRepo.findActiveByUserId(userId);
      const userAvatar = resolveMediaUrl(avatar?.imageUrl || null);

      return {
        id: updatedListing.id,
        title: nft.name,
        description: nft.description || undefined,
        username,
        price: updatedListing.price.toString(),
        image: resolveMediaUrl(nft.imageUrl) || nft.imageUrl,
        userAvatar: userAvatar || undefined,
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

      // Invalidate cache (async, don't wait)
      invalidateNFTListingCache({
        nftId: listing.nftId,
        userId,
      }).catch(error => {
        logger.error('Error invalidating NFT listing cache:', error);
      });
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

      // NFT'yi bul; bulunamazsa listing ID olarak çözümle
      let nft = await this.nftRepo.findById(nftId);
      let listing = await this.listingRepo.findActiveByNftId(nftId);

      if (!nft && !listing) {
        const listingById = await this.listingRepo.findById(nftId);
        if (listingById) {
          listing = listingById;
          nft = await this.nftRepo.findById(listingById.nftId);
        }
      } else if (listing && !nft) {
        nft = await this.nftRepo.findById(listing.nftId);
      }

      if (!nft) {
        throw new NotFoundError('NFT bulunamadı');
      }

      // Marketplace'te sadece kozmetik NFT'ler satışa koyulabilir
      if (nft.type !== NFTType.COSMETIC) {
        throw new ValidationError('Marketplace\'te sadece kozmetik NFT\'ler satışa koyulabilir');
      }

      // NFT'nin kullanıcıya ait olduğunu kontrol et
      if (!nft.belongsToUser(userId)) {
        throw new ValidationError('Bu NFT size ait değil');
      }

      // Aktif listing var mı kontrol et
      const activeListing = listing || (await this.listingRepo.findActiveByNftId(nft.id));

      // Increment view count (her request'te artır)
      await this.nftRepo.incrementViewCount(nft.id);

      // Viewer sayısı: viewCount field'ından al
      const viewerCount = await this.nftRepo.getViewCount(nft.id);

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
        title: nft.name,
        description: nft.description || undefined,
        image: resolveMediaUrl(nft.imageUrl) || nft.imageUrl,
        type: nft.getTypeDisplayName(),
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
  async getSellNFTDetail(userId: string, nftOrListingId: string): Promise<SellNFTDetail> {
    let nftIdForLog = nftOrListingId;
    try {
      const prisma = getPrisma();

      // NFT'yi bul; bulunamazsa listing üzerinden çözümle
      let nft = await this.nftRepo.findById(nftOrListingId);
      let listing = await this.listingRepo.findActiveByNftId(nftOrListingId);

      if (!nft && !listing) {
        const listingById = await this.listingRepo.findById(nftOrListingId);
        if (listingById) {
          listing = listingById;
          nft = await this.nftRepo.findById(listingById.nftId);
        }
      } else if (listing && !nft) {
        nft = await this.nftRepo.findById(listing.nftId);
      }

      if (!nft) {
        throw new Error('NFT bulunamadı');
      }
      const nftId = nft.id;
      nftIdForLog = nftId;

      // Marketplace'te sadece kozmetik NFT'ler
      if (nft.type !== NFTType.COSMETIC) {
        throw new ValidationError('Marketplace\'te sadece kozmetik NFT\'ler görüntülenebilir');
      }

      // NFT'nin kullanıcıya ait olduğunu kontrol et
      const isOwner = nft.belongsToUser(userId);

      // Aktif listing'i bul (eğer varsa)
      const activeListing = listing || (await this.listingRepo.findActiveByNftId(nftId));
      // Eğer sahibi değilse ve aktif listing yoksa detay verilmez
      if (!isOwner && !activeListing) {
        throw new Error('NFT bulunamadı');
      }

      // Increment view count (her request'te artır)
      await this.nftRepo.incrementViewCount(nftId);

      // Viewer sayısı: viewCount field'ından al
      const viewerCount = await this.nftRepo.getViewCount(nftId);

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

      // Owner user bilgisi: NFT modeli ownerId taşımıyor olabilir; listing varsa sellerId, yoksa parametre
      const ownerId =
        nft.currentOwnerId ||
        activeListing?.listedByUserId ||
        userId;
      const ownerProfile = await this.profileRepo.findByUserId(ownerId);
      const ownerName = ownerProfile?.displayName || ownerProfile?.userName || 'Unknown';

      // Price history: NFT'nin tüm listing geçmişi (ACTIVE, SOLD, CANCELLED)
      const priceHistory = await this.getPriceHistory(nftId);

      return {
        id: nft.id,
        title: nft.name,
        description: nft.description || undefined,
        image: resolveMediaUrl(nft.imageUrl) || nft.imageUrl,
        type: nft.getTypeDisplayName(),
        viewer: viewerCount,
        rarity: this.mapRarityToRarityType(nft.rarity),
        price,
        suggestedPrice,
        earnDate,
        totalOwner,
        ownerUser: {
          id: ownerId,
          name: ownerName,
        },
        priceHistory,
      };
    } catch (error) {
      logger.error({
        message: 'Error getting sell NFT detail',
        userId,
        nftId: nftIdForLog,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get price history for an NFT (all listings: ACTIVE, SOLD, CANCELLED)
   */
  private async getPriceHistory(nftId: string): Promise<NFTPriceHistory[]> {
    try {
      // Get all listings for this NFT
      const listings = await this.listingRepo.findListingHistoryByNftId(nftId);

      if (listings.length === 0) {
        return [];
      }

      // Get all unique seller IDs
      const sellerIds = Array.from(new Set(listings.map(l => l.listedByUserId)));

      // Fetch all profiles in parallel
      const profiles = await Promise.all(
        sellerIds.map(id => this.profileRepo.findByUserId(id))
      );

      const profileMap = new Map(
        profiles.filter(p => p).map((p, i) => [sellerIds[i], p])
      );

      // Build price history
      const priceHistory: NFTPriceHistory[] = listings.map(listing => {
        const sellerProfile = profileMap.get(listing.listedByUserId);

        return {
          id: listing.id,
          price: listing.price,
          listedAt: listing.listedAt.toISOString(),
          status: listing.status as 'ACTIVE' | 'SOLD' | 'CANCELLED',
          seller: {
            id: listing.listedByUserId,
            name: sellerProfile?.displayName || sellerProfile?.userName || 'Unknown',
          },
        };
      });

      return priceHistory;
    } catch (error) {
      logger.error({
        message: 'Error getting price history',
        nftId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail the whole request, just return empty array
      return [];
    }
  }

  /**
   * Buy an NFT from marketplace
   */
  async buyNFT(userId: string, request: BuyNFTRequest): Promise<BuyNFTResponse> {
    try {
      // Get listing
      const listing = await this.listingRepo.findById(request.listingId);
      if (!listing) {
        throw new NotFoundError('Listing not found');
      }

      if (!listing.isActive()) {
        throw new ValidationError('Listing is not active');
      }

      // Get NFT
      const nft = await this.nftRepo.findById(listing.nftId);
      if (!nft) {
        throw new NotFoundError('NFT not found');
      }

      // Marketplace'te sadece kozmetik NFT'ler satın alınabilir
      if (nft.type !== NFTType.COSMETIC) {
        throw new ValidationError('Marketplace\'te sadece kozmetik NFT\'ler satın alınabilir');
      }

      // Can't buy your own NFT
      if (listing.listedByUserId === userId) {
        throw new ValidationError('You cannot buy your own NFT');
      }

      // Get buyer and seller profiles
      const [buyerProfile, sellerProfile] = await Promise.all([
        this.profileRepo.findByUserId(userId),
        this.profileRepo.findByUserId(listing.listedByUserId),
      ]);

      // Call TransactionService.buyNFT to handle:
      // - Wallet balance checks
      // - Transaction creation (buyer & seller)
      // - Balance updates
      // - NFT ownership transfer
      // - Listing status update (SOLD)
      const { buyTransaction, sellTransaction } = await this.transactionService.buyNFT(
        userId,
        nft.id,
        listing.price,
        listing.listedByUserId
      );

      // Mark listing as SOLD
      await this.listingRepo.markAsSold(listing.id);

      logger.info({
        message: 'NFT purchased successfully',
        buyerId: userId,
        sellerId: listing.listedByUserId,
        nftId: nft.id,
        price: listing.price,
        listingId: listing.id,
      });

      // Invalidate cache (async, don't wait)
      invalidateNFTTransactionCache({
        nftId: nft.id,
        sellerId: listing.listedByUserId,
        buyerId: userId,
      }).catch(error => {
        logger.error('Error invalidating NFT transaction cache:', error);
      });

      return {
        success: true,
        nftId: nft.id,
        buyerTransaction: {
          id: buyTransaction.id,
          amount: buyTransaction.amount,
          status: buyTransaction.status,
        },
        sellerTransaction: {
          id: sellTransaction.id,
          amount: sellTransaction.amount,
          status: sellTransaction.status,
        },
        newOwner: {
          id: userId,
          name: buyerProfile?.displayName || buyerProfile?.userName || 'Unknown',
        },
      };
    } catch (error) {
      logger.error({
        message: 'Error buying NFT',
        userId,
        listingId: request.listingId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Kullanıcının oluşturduğu ACTIVE listing'leri getirir
   * My Listings ekranı için
   */
  async listMyListings(userId: string, query: ListUserNFTsQuery = {}): Promise<{
    items: UserNFTResponse[];
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    try {
      const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 50;
      
      // Kullanıcının oluşturduğu ACTIVE listing'leri al (sadece COSMETIC NFT'ler)
      const prisma = getPrisma();
      const listings = await prisma.nFTMarketListing.findMany({
        where: {
          listedByUserId: userId,
          status: 'ACTIVE', // Sadece ACTIVE listing'ler
          nft: { type: NFTType.COSMETIC }, // Marketplace sadece kozmetik NFT'ler
        },
        orderBy: { listedAt: 'desc' },
        take: limit + 1,
        cursor: query.cursor ? { id: query.cursor } : undefined,
        skip: query.cursor ? 1 : 0,
        include: {
          nft: true,
        },
      });

      const hasMore = listings.length > limit;
      const paginated = hasMore ? listings.slice(0, limit) : listings;

      // Kullanıcı profilini bir kez al
      const profile = await this.profileRepo.findByUserId(userId);
      const username = profile?.userName || 'Unknown';

      const results: UserNFTResponse[] = paginated.map(listing => {
        const nft = listing.nft;
        
        return {
          id: nft.id,
          title: nft.name,
          username,
          image: resolveMediaUrl(nft.imageUrl) || nft.imageUrl,
          description: nft.description || undefined,
          type: nft.type,
          rarity: nft.rarity,
          listing: {
            id: listing.id,
            price: listing.price,
            listedAt: listing.listedAt.toISOString(),
            status: listing.status as 'ACTIVE' | 'SOLD' | 'CANCELLED',
          },
        };
      });

      const nextCursor = hasMore && results.length > 0 ? paginated[paginated.length - 1].id : undefined;

      return {
        items: results,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error({
        message: 'Error listing user listings',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Kullanıcının satışa koyabileceği NFT'leri getirir
   * Sadece listing'i olmayan NFT'ler döner
   */
  async listAvailableNFTs(userId: string, query: ListUserNFTsQuery = {}): Promise<{
    items: UserNFTResponse[];
    pagination: { cursor?: string; hasMore: boolean; limit: number };
  }> {
    try {
      const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 50;
      
      // Kullanıcının kozmetik NFT'lerini al (marketplace sadece kozmetik)
      const allNfts = await this.nftRepo.findByOwnerId(userId, limit + 50, query.cursor);
      const cosmeticNfts = allNfts.filter(nft => nft.type === NFTType.COSMETIC);
      const nfts = cosmeticNfts.slice(0, limit + 1);
      const hasMore = nfts.length > limit;
      const paginated = hasMore ? nfts.slice(0, limit) : nfts;

      // Kullanıcı profilini bir kez al
      const profile = await this.profileRepo.findByUserId(userId);
      const username = profile?.userName || 'Unknown';

      // Get all NFT IDs to check for active listings
      const nftIds = paginated.map(nft => nft.id);
      
      // Fetch ACTIVE listings for these NFTs
      const prisma = getPrisma();
      const activeListings = await prisma.nFTMarketListing.findMany({
        where: {
          nftId: { in: nftIds },
          listedByUserId: userId,
          status: 'ACTIVE', // Sadece ACTIVE listing'leri kontrol et
        },
      });

      // Create a set of NFT IDs that have active listings
      const listedNftIds = new Set(activeListings.map(listing => listing.nftId));

      // Filter out NFTs that have active listings
      const availableNfts = paginated.filter(nft => !listedNftIds.has(nft.id));

      const results: UserNFTResponse[] = availableNfts.map(nft => {
        return {
          id: nft.id,
          title: nft.name,
          username,
          image: resolveMediaUrl(nft.imageUrl) || nft.imageUrl,
          description: nft.description || undefined,
          type: nft.type,
          rarity: nft.rarity,
          listing: undefined, // Listing yok
        };
      });

      const nextCursor = hasMore && results.length > 0 ? paginated[paginated.length - 1].id : undefined;

      return {
        items: results,
        pagination: {
          cursor: nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error) {
      logger.error({
        message: 'Error listing available NFTs',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

