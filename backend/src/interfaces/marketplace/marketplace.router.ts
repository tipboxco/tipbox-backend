import { Router, Request, Response } from 'express';
import { MarketplaceService } from '../../application/marketplace/marketplace.service';
import {
  ListMarketplaceNFTsQuery,
  CreateListingRequest,
  UpdateListingPriceRequest,
  BuyNFTRequest,
} from './marketplace.dto';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import logger from '../../infrastructure/logger/logger';

const router = Router();
const marketplaceService = new MarketplaceService();

/**
 * @openapi
 * /marketplace/listings:
 *   get:
 *     summary: Satışta bulunan NFT'lerin listesini getirir
 *     description: Marketplace'te satışta olan NFT'leri arama ve filtreleme seçenekleri ile getirir
 *     tags: [Marketplace]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: NFT name veya description'da arama yapar
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum fiyat filtresi
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maksimum fiyat filtresi
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [BADGE, COSMETIC, LOOTBOX, ALL]
 *         description: NFT tipi filtresi. BADGE, COSMETIC, LOOTBOX veya ALL (tüm tipler). Gönderilmediğinde tüm tipler döner.
 *       - in: query
 *         name: rarity
 *         schema:
 *           type: string
 *           enum: [COMMON, RARE, EPIC]
 *         description: NFT nadirliği filtresi
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *         description: Sayfalama limiti
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Son alınan item'ın ID'si (cursor)
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           enum: [price_asc, price_desc, listedAt_desc, listedAt_asc]
 *           default: listedAt_desc
 *         description: Sıralama kriteri
 *     responses:
 *       200:
 *         description: Başarılı - NFT listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   username:
 *                     type: string
 *                   price:
 *                     type: string
 *                   image:
 *                     type: string
 *                   userAvatar:
 *                     type: string
 *       500:
 *         description: Sunucu hatası
 */
router.get('/listings', asyncHandler(async (req: Request, res: Response) => {
  // Type parametresini kontrol et - enum olarak kabul et (BADGE, COSMETIC, LOOTBOX)
  // ALL veya undefined ise tüm tipleri döndür
  let type: 'BADGE' | 'COSMETIC' | 'LOOTBOX' | undefined = undefined;
  const typeParam = req.query.type as string | undefined;
  
  if (typeParam && typeParam !== 'ALL') {
    const validTypes = ['BADGE', 'COSMETIC', 'LOOTBOX'];
    if (validTypes.includes(typeParam.toUpperCase())) {
      type = typeParam.toUpperCase() as 'BADGE' | 'COSMETIC' | 'LOOTBOX';
    } else {
      return res.status(400).json({ 
        message: `Invalid type parameter. Must be one of: BADGE, COSMETIC, LOOTBOX, or ALL` 
      });
    }
  }
  // typeParam === 'ALL' veya undefined ise type undefined kalır (tüm tipler döner)

  const query: ListMarketplaceNFTsQuery = {
    search: req.query.search as string | undefined,
    minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
    type,
    rarity: req.query.rarity as 'COMMON' | 'RARE' | 'EPIC' | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    orderBy: req.query.orderBy as 'price_asc' | 'price_desc' | 'listedAt_desc' | 'listedAt_asc' | undefined,
  };

  const listings = await marketplaceService.listActiveListings(query);
  return res.json(listings);
}));

/**
 * @openapi
 * /marketplace/my-nfts:
 *   get:
 *     summary: Kullanıcının sahip olduğu NFT'lerin listesini getirir
 *     description: Authenticated kullanıcının sahip olduğu NFT'leri listeler
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *         description: Sayfalama limiti
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Son alınan item'ın ID'si (cursor)
 *     responses:
 *       200:
 *         description: Başarılı - Kullanıcının NFT listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       username:
 *                         type: string
 *                       image:
 *                         type: string
 *                       description:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [BADGE, COSMETIC, LOOTBOX]
 *                         example: BADGE
 *                       rarity:
 *                         type: string
 *                         enum: [COMMON, RARE, EPIC]
 *                         example: RARE
 *                       listing:
 *                         type: object
 *                         description: Listing bilgisi (varsa)
 *                         properties:
 *                           id:
 *                             type: string
 *                           price:
 *                             type: number
 *                           listedAt:
 *                             type: string
 *                             format: date-time
 *                           status:
 *                             type: string
 *                             enum: [ACTIVE, SOLD, CANCELLED]
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     cursor:
 *                       type: string
 *                     hasMore:
 *                       type: boolean
 *                     limit:
 *                       type: number
 *       401:
 *         description: Yetkisiz erişim
 *       500:
 *         description: Sunucu hatası
 */
router.get('/my-nfts', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  const userId = user?.sub || user?.userId || user?.id;
  
  // Debug logging
  logger.info({
    message: 'my-nfts endpoint called',
    user: user,
    userId: userId,
    headers: {
      authorization: req.headers.authorization ? 'Present' : 'Missing'
    }
  });
  
  if (!userId) {
    logger.warn({
      message: 'my-nfts: User ID not found in token',
      user: user
    });
    return res.status(401).json({ 
      message: 'Unauthorized', 
      debug: 'User ID not found in token',
      userObject: user 
    });
  }

  const query = {
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
  };

  const nfts = await marketplaceService.listUserNFTs(userId, query);
  
  logger.info({
    message: 'my-nfts response',
    userId,
    itemCount: nfts.items.length
  });
  
  res.json(nfts);
}));

/**
 * @swagger
 * /marketplace/my-listings:
 *   get:
 *     tags: [Marketplace]
 *     summary: Kullanıcının ACTIVE listing'lerini getirir
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *         description: Sayfa başına item sayısı
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Son alınan item'ın ID'si (cursor)
 *     responses:
 *       200:
 *         description: Başarılı - Kullanıcının ACTIVE listing listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       username:
 *                         type: string
 *                       image:
 *                         type: string
 *                       description:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [BADGE, COSMETIC, LOOTBOX]
 *                       rarity:
 *                         type: string
 *                         enum: [COMMON, RARE, EPIC]
 *                       listing:
 *                         type: object
 *                         required: true
 *                         description: Always present and ACTIVE status
 *                         properties:
 *                           id:
 *                             type: string
 *                           price:
 *                             type: number
 *                           listedAt:
 *                             type: string
 *                             format: date-time
 *                           status:
 *                             type: string
 *                             enum: [ACTIVE]
 *                             description: Always ACTIVE
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     cursor:
 *                       type: string
 *                     hasMore:
 *                       type: boolean
 *                     limit:
 *                       type: number
 *       401:
 *         description: Yetkisiz erişim
 *       500:
 *         description: Sunucu hatası
 */
router.get('/my-listings', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  const userId = user?.sub || user?.userId || user?.id;
  
  if (!userId) {
    return res.status(401).json({ 
      message: 'Unauthorized', 
      debug: 'User ID not found in token',
    });
  }

  const query = {
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
  };

  const listings = await marketplaceService.listMyListings(userId, query);
  
  logger.info({
    message: 'my-listings response',
    userId,
    itemCount: listings.items.length
  });
  
  res.json(listings);
}));

/**
 * @swagger
 * /marketplace/available-nfts:
 *   get:
 *     tags: [Marketplace]
 *     summary: Kullanıcının satışa koyabileceği NFT'leri getirir (listing'i olmayan)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *         description: Sayfa başına item sayısı
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Son alınan item'ın ID'si (cursor)
 *     responses:
 *       200:
 *         description: Başarılı - Satışa koyulabilecek NFT listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       username:
 *                         type: string
 *                       image:
 *                         type: string
 *                       description:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [BADGE, COSMETIC, LOOTBOX]
 *                       rarity:
 *                         type: string
 *                         enum: [COMMON, RARE, EPIC]
 *                       listing:
 *                         type: null
 *                         description: Always null for available NFTs
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     cursor:
 *                       type: string
 *                     hasMore:
 *                       type: boolean
 *                     limit:
 *                       type: number
 *       401:
 *         description: Yetkisiz erişim
 *       500:
 *         description: Sunucu hatası
 */
router.get('/available-nfts', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  const userId = user?.sub || user?.userId || user?.id;
  
  if (!userId) {
    return res.status(401).json({ 
      message: 'Unauthorized', 
      debug: 'User ID not found in token',
    });
  }

  const query = {
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
  };

  const nfts = await marketplaceService.listAvailableNFTs(userId, query);
  
  logger.info({
    message: 'available-nfts response',
    userId: userId,
    nftCount: nfts.items.length
  });
  
  return res.json(nfts);
}));

/**
 * @openapi
 * /marketplace/listings:
 *   post:
 *     summary: NFT'yi satışa koyar
 *     description: Kullanıcının sahip olduğu NFT'yi belirlenen fiyattan marketplace'e ekler
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nftId
 *               - amount
 *             properties:
 *               nftId:
 *                 type: string
 *                 description: Satışa konulacak NFT'nin ID'si
 *               amount:
 *                 type: number
 *                 description: TIPS miktarı (fiyat)
 *     responses:
 *       200:
 *         description: Başarılı - Listing oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 description:
 *                   type: string
 *                 username:
 *                   type: string
 *                 price:
 *                   type: string
 *                 image:
 *                   type: string
 *                 rarity:
 *                   type: string
 *                 type:
 *                   type: string
 *                 listedAt:
 *                   type: string
 *                 sellerId:
 *                   type: string
 *                 nftId:
 *                   type: string
 *       400:
 *         description: Geçersiz istek (NFT bulunamadı, zaten satışta, vb.)
 *       401:
 *         description: Yetkisiz erişim
 *       500:
 *         description: Sunucu hatası
 */
router.post('/listings', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub || req.user?.userId || req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const request: CreateListingRequest = {
    nftId: req.body.nftId,
    amount: req.body.amount,
  };

  if (!request.nftId || !request.amount || request.amount <= 0) {
    return res.status(400).json({ message: 'nftId ve amount (pozitif sayı) gerekli' });
  }

  const listing = await marketplaceService.createListing(userId, request);
  return res.json(listing);
}));

/**
 * @openapi
 * /marketplace/listings/{listingId}/price:
 *   put:
 *     summary: Listing fiyatını günceller
 *     description: Kullanıcının sahip olduğu bir listing'in fiyatını günceller
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Listing ID'si
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Yeni TIPS miktarı (fiyat)
 *     responses:
 *       200:
 *         description: Başarılı - Fiyat güncellendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 description:
 *                   type: string
 *                 username:
 *                   type: string
 *                 price:
 *                   type: string
 *                 image:
 *                   type: string
 *                 rarity:
 *                   type: string
 *                 type:
 *                   type: string
 *                 listedAt:
 *                   type: string
 *                 sellerId:
 *                   type: string
 *                 nftId:
 *                   type: string
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Listing bulunamadı
 *       500:
 *         description: Sunucu hatası
 */
router.put('/listings/:listingId/price', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub || req.user?.userId || req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const listingId = req.params.listingId;
  const request: UpdateListingPriceRequest = {
    amount: req.body.amount,
  };

  if (!request.amount || request.amount <= 0) {
    return res.status(400).json({ message: 'amount pozitif bir sayı olmalı' });
  }

  const listing = await marketplaceService.updateListingPrice(userId, listingId, request);
  return res.json(listing);
}));

/**
 * @openapi
 * /marketplace/listings/{listingId}:
 *   delete:
 *     summary: Listing'i iptal eder (delist)
 *     description: Kullanıcının sahip olduğu bir listing'i marketplace'ten kaldırır
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Listing ID'si
 *     responses:
 *       200:
 *         description: Başarılı - Listing iptal edildi
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Listing bulunamadı
 *       500:
 *         description: Sunucu hatası
 */
router.delete('/listings/:listingId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub || req.user?.userId || req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const listingId = req.params.listingId;
  await marketplaceService.cancelListing(userId, listingId);
  return res.json({ message: 'Listing başarıyla iptal edildi' });
}));

/**
 * @openapi
 * /marketplace/sell/{nftId}:
 *   get:
 *     summary: NFT satış bilgilerini getirir
 *     description: Kullanıcının sahip olduğu NFT için satış bilgilerini (fiyat, gas fee, earnings vb.) getirir
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nftId
 *         required: true
 *         schema:
 *           type: string
 *         description: NFT ID'si
 *     responses:
 *       200:
 *         description: Başarılı - NFT satış bilgileri
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 description:
 *                   type: string
 *                 image:
 *                   type: string
 *                 type:
 *                   type: string
 *                 viewer:
 *                   type: number
 *                 rarity:
 *                   type: string
 *                   enum: [usual, rare, epic, legendary]
 *                 price:
 *                   type: number
 *                 suggestedPrice:
 *                   type: number
 *                 gasFee:
 *                   type: number
 *                 earningsAfterSales:
 *                   type: number
 *       400:
 *         description: Geçersiz istek (NFT bulunamadı, zaten satışta, vb.)
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: NFT bulunamadı
 *       500:
 *         description: Sunucu hatası
 */
router.get('/sell/:nftId', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub || req.user?.userId || req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const nftId = req.params.nftId;
  const sellInfo = await marketplaceService.getSellNFTInfo(userId, nftId);
  return res.json(sellInfo);
}));

/**
 * @openapi
 * /marketplace/sell/{nftId}/detail:
 *   get:
 *     summary: NFT satış detayını getirir
 *     description: Kullanıcının sahip olduğu NFT için detaylı satış bilgilerini (owner, earn date, total owner vb.) getirir
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: nftId
 *         required: true
 *         schema:
 *           type: string
 *         description: NFT ID'si
 *     responses:
 *       200:
 *         description: Başarılı - NFT satış detayı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 title:
 *                   type: string
 *                 description:
 *                   type: string
 *                 image:
 *                   type: string
 *                 type:
 *                   type: string
 *                 viewer:
 *                   type: number
 *                 rarity:
 *                   type: string
 *                   enum: [usual, rare, epic, legendary]
 *                 price:
 *                   type: number
 *                 suggestedPrice:
 *                   type: number
 *                 earnDate:
 *                   type: string
 *                   format: date-time
 *                 totalOwner:
 *                   type: number
 *                 ownerUser:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                 priceHistory:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       price:
 *                         type: number
 *                       listedAt:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                         enum: [ACTIVE, SOLD, CANCELLED]
 *                       seller:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: NFT bulunamadı
 *       500:
 *         description: Sunucu hatası
 */
router.get('/sell/:nftId/detail', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub || req.user?.userId || req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const nftId = req.params.nftId;
  const sellDetail = await marketplaceService.getSellNFTDetail(userId, nftId);
  return res.json(sellDetail);
}));

/**
 * @openapi
 * /marketplace/buy:
 *   post:
 *     summary: NFT'yi satın alır
 *     description: Marketplace'te satışta olan bir NFT'yi satın alır. Buyer'ın bakiyesinden düşüp seller'a transfer eder.
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - listingId
 *             properties:
 *               listingId:
 *                 type: string
 *                 description: Satın alınacak listing'in ID'si
 *                 example: "fdc35c33-4182-401f-83ee-d48357256c72"
 *     responses:
 *       200:
 *         description: Başarılı - NFT satın alındı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 nftId:
 *                   type: string
 *                 buyerTransaction:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     status:
 *                       type: string
 *                       enum: [created, pending, confirmed, failed]
 *                 sellerTransaction:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     status:
 *                       type: string
 *                       enum: [created, pending, confirmed, failed]
 *                 newOwner:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *       400:
 *         description: Geçersiz istek (yetersiz bakiye, listing aktif değil, kendi NFT'nizi alamazsınız, vb.)
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: Listing veya NFT bulunamadı
 *       500:
 *         description: Sunucu hatası
 */
router.post('/buy', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub || req.user?.userId || req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const request: BuyNFTRequest = {
    listingId: req.body.listingId,
  };

  if (!request.listingId) {
    return res.status(400).json({ message: 'listingId gerekli' });
  }

  const result = await marketplaceService.buyNFT(userId, request);
  return res.json(result);
}));

export default router;

