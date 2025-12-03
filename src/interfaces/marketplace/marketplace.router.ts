import { Router, Request, Response } from 'express';
import { MarketplaceService } from '../../application/marketplace/marketplace.service';
import {
  ListMarketplaceNFTsQuery,
  CreateListingRequest,
  UpdateListingPriceRequest,
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
 *           enum: [BADGE, COSMETIC, LOOTBOX]
 *         description: NFT tipi filtresi
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
 *         name: offset
 *         schema:
 *           type: number
 *           default: 0
 *         description: Sayfalama offset'i
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
  const query: ListMarketplaceNFTsQuery = {
    search: req.query.search as string | undefined,
    minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
    type: req.query.type as 'BADGE' | 'COSMETIC' | 'LOOTBOX' | undefined,
    rarity: req.query.rarity as 'COMMON' | 'RARE' | 'EPIC' | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
    orderBy: req.query.orderBy as 'price_asc' | 'price_desc' | 'listedAt_desc' | 'listedAt_asc' | undefined,
  };

  const listings = await marketplaceService.listActiveListings(query);
  res.json(listings);
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
 *         name: offset
 *         schema:
 *           type: number
 *           default: 0
 *         description: Sayfalama offset'i
 *     responses:
 *       200:
 *         description: Başarılı - Kullanıcının NFT listesi
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
 *                   image:
 *                     type: string
 *       401:
 *         description: Yetkisiz erişim
 *       500:
 *         description: Sunucu hatası
 */
router.get('/my-nfts', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
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
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  };

  const nfts = await marketplaceService.listUserNFTs(userId, query);
  
  logger.info({
    message: 'my-nfts response',
    userId: userId,
    nftCount: nfts.length
  });
  
  res.json(nfts);
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
  const userId = (req as any).user?.sub || (req as any).user?.userId || (req as any).user?.id;
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
  res.json(listing);
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
  const userId = (req as any).user?.sub || (req as any).user?.userId || (req as any).user?.id;
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
  res.json(listing);
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
  const userId = (req as any).user?.sub || (req as any).user?.userId || (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const listingId = req.params.listingId;
  await marketplaceService.cancelListing(userId, listingId);
  res.json({ message: 'Listing başarıyla iptal edildi' });
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
  const userId = (req as any).user?.sub || (req as any).user?.userId || (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const nftId = req.params.nftId;
  const sellInfo = await marketplaceService.getSellNFTInfo(userId, nftId);
  res.json(sellInfo);
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
  const userId = (req as any).user?.sub || (req as any).user?.userId || (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const nftId = req.params.nftId;
  const sellDetail = await marketplaceService.getSellNFTDetail(userId, nftId);
  res.json(sellDetail);
}));

export default router;

