import express, { Request, Response } from 'express';
import { WalletService } from '../../application/wallet/wallet.service';
import { TipsBalanceService } from '../../application/wallet/tips-balance.service';
import { TransactionService } from '../../application/transaction/transaction.service';
import { RewardClaimService } from '../../application/reward/reward-claim.service';
import { getWalletProvider } from '../../application/wallet/provider/wallet-provider.factory';
import { parseContractError } from '../../application/wallet/thirdweb-sdk/contract-errors';
import { createWeb3NftService, resolveNftImageUrl } from '../../application/wallet/web3-nft-service';
import { ConnectWalletRequest, WalletResponse, WalletNftsResponse, NftItemResponse } from './wallet.dto';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import {
  WalletProviderNotConfiguredError,
} from '../../infrastructure/errors/custom-errors';
import { WalletProvider } from '../../domain/wallet/wallet.entity';
import { RewardSourceType } from '../../domain/reward/reward-source-type.enum';
import { authMiddleware } from '../auth/auth.middleware';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import { TransactionActionType } from '../../domain/transaction/transaction-action-type.enum';
import { CacheService } from '../../infrastructure/cache/cache.service';
import logger from '../../infrastructure/logger/logger';

const router = express.Router();
const cache = new CacheService();

const BALANCE_SYNC_TTL_SECONDS = 30;
const balanceSyncThrottleKey = (walletId: string) => `balance-sync-throttle:${walletId}`;
const walletService = new WalletService();
const tipsBalanceService = new TipsBalanceService();
const transactionService = new TransactionService();
const rewardClaimService = new RewardClaimService();

/** NoBadgeOwned: contract'tan dönen hata adı – badge yoksa mint sonrası claim tekrarlanır. */
const CONTRACT_ERROR_NO_BADGE_OWNED = 'NoBadgeOwned';

router.use(authMiddleware);

/**
 * @openapi
 * /api/wallets:
 *   get:
 *     summary: Kullanıcının tüm wallet'larını getir
 *     description: Kullanıcıya ait tüm bağlı/bağlı olmayan wallet'ların listesini döndürür
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet listesi başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   userId:
 *                     type: string
 *                   publicAddress:
 *                     type: string
 *                   provider:
 *                     type: string
 *                     enum: [METAMASK, WALLET_CONNECT, COINBASE, CUSTOM]
 *                   isConnected:
 *                     type: boolean
 *                   shortAddress:
 *                     type: string
 *                   providerIcon:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Wallet yoksa Thirdweb ile oturum açıp DB'ye otomatik kaydet
  await walletService.ensureWalletForUser(String(userId));

  // Contract → DB sync: pasif (WALLET_BALANCE_SYNC_ENABLED=true yapılırsa çalışır)
  const balanceSyncEnabled = process.env.WALLET_BALANCE_SYNC_ENABLED === 'true';
  const preferredWallet = await walletService.getPreferredWalletForBalance(String(userId));
  if (balanceSyncEnabled && preferredWallet?.id) {
    walletService.syncWalletBalanceFromChain(preferredWallet.id).catch((err) => {
      logger.debug({ walletId: preferredWallet.id, error: String(err), message: 'syncWalletBalanceFromChain on wallet list' });
    });
  }

  const wallets = await walletService.getUserWallets(String(userId));
  const response: WalletResponse[] = wallets.map(wallet => ({
    id: wallet.id,
    userId: wallet.userId,
    publicAddress: wallet.smartAccountAddress,
    smartAccountAddress: wallet.smartAccountAddress ?? undefined,
    provider: wallet.provider,
    isConnected: wallet.isConnected,
    shortAddress: wallet.getShortAddress(),
    shortSmartAccountAddress: wallet.getShortSmartAccountAddress() ?? undefined,
    providerIcon: wallet.getProviderIcon(),
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString()
  }));

  return res.json(response);
}));

/**
 * @openapi
 * /api/wallets/active:
 *   get:
 *     summary: Aktif wallet'ı getir
 *     description: Kullanıcının aktif olarak kullandığı wallet bilgilerini döndürür
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Aktif wallet başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 userId:
 *                   type: string
 *                 publicAddress:
 *                   type: string
 *                 provider:
 *                   type: string
 *                   enum: [METAMASK, WALLET_CONNECT, COINBASE, CUSTOM]
 *                 isConnected:
 *                   type: boolean
 *                 shortAddress:
 *                   type: string
 *                 providerIcon:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No active wallet found
 */
router.get('/active', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const activeWallet = await walletService.getActiveWallet(String(userId));
  if (!activeWallet) {
    return res.status(404).json({ success: false, message: 'No active wallet found' });
  }

  const response: WalletResponse = {
    id: activeWallet.id,
    userId: activeWallet.userId,
    publicAddress: activeWallet.publicAddress,
    provider: activeWallet.provider,
    isConnected: activeWallet.isConnected,
    shortAddress: activeWallet.getShortAddress(),
    providerIcon: activeWallet.getProviderIcon(),
    createdAt: activeWallet.createdAt.toISOString(),
    updatedAt: activeWallet.updatedAt.toISOString()
  };

  return res.json(response);
}));

/**
 * @openapi
 * /api/wallets/connect:
 *   post:
 *     summary: Yeni bir wallet bağla
 *     description: Kullanıcı için yeni bir kripto wallet'ı bağlar (MetaMask, WalletConnect, vb.)
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - publicAddress
 *               - provider
 *             properties:
 *               publicAddress:
 *                 type: string
 *                 description: Wallet'ın public adresi (0x ile başlayan 42 karakter)
 *                 example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *               provider:
 *                 type: string
 *                 enum: [METAMASK, WALLET_CONNECT, COINBASE, CUSTOM]
 *                 description: Wallet sağlayıcısı
 *                 example: "METAMASK"
 *     responses:
 *       201:
 *         description: Wallet başarıyla bağlandı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 userId:
 *                   type: string
 *                 publicAddress:
 *                   type: string
 *                 provider:
 *                   type: string
 *                 isConnected:
 *                   type: boolean
 *                 shortAddress:
 *                   type: string
 *                 providerIcon:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid wallet address or provider
 *       401:
 *         description: Unauthorized
 */
router.post('/connect', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { publicAddress, provider }: ConnectWalletRequest = req.body;

  // Validation
  if (!walletService.validateWalletAddress(publicAddress)) {
    return res.status(400).json({ success: false, message: 'Invalid wallet address format' });
  }

  if (!Object.values(WalletProvider).includes(provider as WalletProvider)) {
    return res.status(400).json({ success: false, message: 'Invalid wallet provider' });
  }

  const wallet = await walletService.connectWallet(String(userId), publicAddress, provider as WalletProvider);

  const response: WalletResponse = {
    id: wallet.id,
    userId: wallet.userId,
    publicAddress: wallet.smartAccountAddress,
    provider: wallet.provider,
    isConnected: wallet.isConnected,
    shortAddress: wallet.getShortAddress(),
    providerIcon: wallet.getProviderIcon(),
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString()
  };

  return res.status(201).json(response);
}));

/**
 * @openapi
 * /api/wallets/{id}/disconnect:
 *   patch:
 *     summary: Wallet bağlantısını kes
 *     description: Belirtilen wallet'ın bağlantısını keser (silmez, sadece deaktive eder)
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Wallet ID
 *     responses:
 *       200:
 *         description: Wallet bağlantısı başarıyla kesildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 userId:
 *                   type: string
 *                 publicAddress:
 *                   type: string
 *                 provider:
 *                   type: string
 *                 isConnected:
 *                   type: boolean
 *                   example: false
 *                 shortAddress:
 *                   type: string
 *                 providerIcon:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Wallet not found
 */
router.patch('/:id/disconnect', asyncHandler(async (req: Request, res: Response) => {
  const walletId = req.params.id;

  const wallet = await walletService.disconnectWallet(walletId);
  if (!wallet) {
    return res.status(404).json({ success: false, message: 'Wallet not found' });
  }

  const response: WalletResponse = {
    id: wallet.id,
    userId: wallet.userId,
    publicAddress: wallet.smartAccountAddress,
    provider: wallet.provider,
    isConnected: wallet.isConnected,
    shortAddress: wallet.getShortAddress(),
    providerIcon: wallet.getProviderIcon(),
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString()
  };

  return res.json(response);
}));

/**
 * @openapi
 * /api/wallets/{id}/activate:
 *   patch:
 *     summary: Wallet'ı aktif hale getir
 *     description: Belirtilen wallet'ı aktif wallet olarak ayarlar (diğer wallet'lar deaktive edilir)
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Wallet ID
 *     responses:
 *       200:
 *         description: Wallet başarıyla aktif hale getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 userId:
 *                   type: string
 *                 publicAddress:
 *                   type: string
 *                 provider:
 *                   type: string
 *                 isConnected:
 *                   type: boolean
 *                   example: true
 *                 shortAddress:
 *                   type: string
 *                 providerIcon:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Wallet not found
 */
router.patch('/:id/activate', asyncHandler(async (req: Request, res: Response) => {
  const walletId = req.params.id;

  const wallet = await walletService.switchActiveWallet(walletId);
  if (!wallet) {
    return res.status(404).json({ success: false, message: 'Wallet not found' });
  }

  const response: WalletResponse = {
    id: wallet.id,
    userId: wallet.userId,
    publicAddress: wallet.smartAccountAddress,
    provider: wallet.provider,
    isConnected: wallet.isConnected,
    shortAddress: wallet.getShortAddress(),
    providerIcon: wallet.getProviderIcon(),
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString()
  };

  return res.json(response);
}));

/**
 * @openapi
 * /api/wallets/{id}:
 *   delete:
 *     summary: Wallet'ı tamamen sil
 *     description: Belirtilen wallet'ı sistemden kalıcı olarak siler
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Wallet ID
 *     responses:
 *       204:
 *         description: Wallet başarıyla silindi
 *       404:
 *         description: Wallet not found
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const walletId = req.params.id;

  const deleted = await walletService.removeWallet(walletId);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Wallet not found' });
  }

  return res.status(204).send();
}));

/**
 * @openapi
 * /api/wallets/nfts:
 *   get:
 *     summary: Kullanıcının Smart Account NFT'lerini getir
 *     description: |
 *       Sadece Smart Account adresindeki NFT'leri Tipbox badge contract'tan okur.
 *       Smart Account yoksa 400 döner. tokenOfOwnerByIndex ve tokenURI ile metadata decode edilir.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: NFT listesi başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 nfts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/NftItemResponse'
 *                 totalCount:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Smart Account bulunamadı (wallet bağlanıp Smart Account oluşturulmalı)
 *       404:
 *         description: Wallet bulunamadı
 */
router.get('/nfts', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  await walletService.ensureWalletForUser(String(userId));

  const wallet = await walletService.getPreferredWalletForBalance(String(userId));
  if (!wallet) {
    return res.status(404).json({
      success: false,
      nfts: [],
      totalCount: 0,
      error: 'Wallet not found',
    } as WalletNftsResponse);
  }

  const smartAccountAddress = wallet.smartAccountAddress;
  if (!smartAccountAddress) {
    return res.status(400).json({
      success: false,
      nfts: [],
      totalCount: 0,
      error: 'Smart Account required. Connect your Thirdweb wallet first to create a Smart Account.',
    } as WalletNftsResponse);
  }

  const nftService = createWeb3NftService();
  const listResult = await nftService.getWalletNFTs(smartAccountAddress);

  if (!listResult.success) {
    return res.status(200).json({
      success: false,
      nfts: [],
      totalCount: 0,
      error: listResult.error,
    } as WalletNftsResponse);
  }

  const nfts: NftItemResponse[] = listResult.nfts.map((nft) => {
    const resolvedImageUrl = resolveNftImageUrl(nft.metadata);
    const metadataWithImage = nft.metadata
      ? { ...nft.metadata, image: resolvedImageUrl ?? nft.metadata.image }
      : undefined;
    return {
      contractAddress: nft.contractAddress,
      tokenId: nft.tokenId,
      name: nft.metadata?.name ?? nft.collectionName ?? 'Unknown',
      description: nft.metadata?.description || undefined,
      imageUrl: resolvedImageUrl,
      metadata: metadataWithImage as Record<string, unknown> | undefined,
      tokenType: 'ERC721' as const,
    };
  });

  const response: WalletNftsResponse = {
    success: true,
    nfts,
    totalCount: nfts.length,
  };

  return res.json(response);
}));

/**
 * @openapi
 * /api/wallets/transactions:
 *   get:
 *     summary: Kullanıcının TIPS transaction geçmişini getir
 *     description: Kullanıcının TIPS gönderme/alma işlemlerinin geçmişini pagination ile getirir
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor (son transaction'ın id'si)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Sayfa başına transaction sayısı
 *     responses:
 *       200:
 *         description: Transaction geçmişi başarıyla getirildi
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
 *                         format: uuid
 *                       type:
 *                         type: string
 *                         enum: [received, sent]
 *                         description: Transaction tipi (received = alınan, sent = gönderilen)
 *                       amount:
 *                         type: number
 *                         description: TIPS miktarı
 *                       currency:
 *                         type: string
 *                         default: "TIPS"
 *                       from:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           avatar:
 *                             type: string
 *                             nullable: true
 *                         description: Gönderen kullanıcı (type=sent ise null)
 *                       to:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           avatar:
 *                             type: string
 *                             nullable: true
 *                         description: Alıcı kullanıcı (type=received ise null)
 *                       reason:
 *                         type: string
 *                         nullable: true
 *                         description: "İşlem nedeni (örn. Post beğenisi, Expert sorusu, TIPS gönderimi)"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     cursor:
 *                       type: string
 *                     hasMore:
 *                       type: boolean
 *                     limit:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/transactions', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const cursor = req.query.cursor as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

  if (limit < 1 || limit > 50) {
    return res.status(400).json({ success: false, message: 'Limit must be between 1 and 50' });
  }

  // Cache kontrolü - Transaction history asla cache'lenmemeli
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const result = await transactionService.getUserTransactionHistory(String(userId), {
      cursor,
      limit,
    });

    const prisma = getPrisma();
    const items = await Promise.all(
      result.items.map(async (tx) => {
        let fromUser: { id: string; name: string; avatar: string | null } | null = null;
        let toUser: { id: string; name: string; avatar: string | null } | null = null;

        if (tx.metadata?.senderUserId && !String(tx.metadata.senderUserId).startsWith('0x')) {
          const sender = await prisma.user.findUnique({
            where: { id: tx.metadata.senderUserId as string },
            include: {
              profile: true,
              avatars: { where: { isActive: true }, take: 1 },
            },
          });
          if (sender) {
            fromUser = {
              id: sender.id,
              name: sender.profile?.displayName || 'Unknown',
              avatar: sender.avatars[0]?.imageUrl || null,
            };
          }
        }
        if (tx.actionType === TransactionActionType.DEPOSIT && tx.fromAddress && !fromUser) {
          fromUser = {
            id: tx.fromAddress,
            name: `${tx.fromAddress.slice(0, 6)}...${tx.fromAddress.slice(-4)}`,
            avatar: null,
          };
        }

        if (tx.metadata?.recipientUserId && !String(tx.metadata.recipientUserId).startsWith('0x')) {
          const recipient = await prisma.user.findUnique({
            where: { id: tx.metadata.recipientUserId as string },
            include: {
              profile: true,
              avatars: { where: { isActive: true }, take: 1 },
            },
          });
          if (recipient) {
            toUser = {
              id: recipient.id,
              name: recipient.profile?.displayName || 'Unknown',
              avatar: recipient.avatars[0]?.imageUrl || null,
            };
          }
        }
        if (tx.actionType === TransactionActionType.WITHDRAW && tx.toAddress && !toUser) {
          toUser = {
            id: tx.toAddress,
            name: `${tx.toAddress.slice(0, 6)}...${tx.toAddress.slice(-4)}`,
            avatar: null,
          };
        }

        return {
          id: tx.id,
          type: tx.isSend() ? 'sent' : 'received',
          amount: tx.amount ?? 0,
          currency: 'TIPS',
          from: fromUser,
          to: toUser,
          reason: tx.metadata?.reason ?? null,
          createdAt: tx.createdAt.toISOString(),
        };
      })
    );

    return res.json({
      items,
      pagination: {
        cursor: result.cursor || null,
        hasMore: result.hasMore,
        limit,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get transactions',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}));

/**
 * @openapi
 * /api/wallets/balance:
 *   get:
 *     summary: Kullanıcının TIPS balance'ını getir (DB - wallet tablosu, smartAccountAddress)
 *     description: |
 *       Wallet tablosundaki balance değeri döndürülür. Transaction confirm edildiğinde DB güncellendiği için
 *       bakiye hemen yansır. Arka planda chain ile sync çalışır (deposit vb. için).
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Balance başarıyla getirildi (DB)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance: { type: number, description: 'Mevcut TIPS bakiyesi (DB)' }
 *                 currency: { type: string, default: "TIPS" }
 *                 locked: { type: number, description: 'Kilitli TIPS (DB)' }
 *                 available: { type: number, description: 'balance - locked' }
 *                 pendingTips: { type: number }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Wallet bulunamadı
 */
router.get('/balance', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  await walletService.ensureWalletForUser(String(userId));
  const wallet = await walletService.getPreferredWalletForBalance(String(userId));
  if (!wallet) {
    return res.status(404).json({
      success: false,
      message: 'No wallet found',
      balance: 0,
      currency: 'TIPS',
      locked: 0,
      available: 0,
      pendingTips: 0,
    });
  }

  // Contract → DB sync: throttle ile en fazla 30 saniyede bir tetiklenir
  const sdk = getWalletProvider();
  if (sdk.isConfigured() && wallet.smartAccountAddress) {
    const shouldSync = await cache.setNX(balanceSyncThrottleKey(wallet.id), '1', BALANCE_SYNC_TTL_SECONDS);
    if (shouldSync) {
      const syncResult = await walletService.syncWalletBalanceFromChain(wallet.id);
      if (!syncResult.success) {
        logger.warn({ walletId: wallet.id, error: syncResult.error, message: 'syncWalletBalanceFromChain failed, returning DB values' });
      }
    }
  }

  // Güncel balance ve locked (pendingTips) DB'den
  let { balance: balanceFromDb, lockedBalance: lockedFromDb } = await walletService.getBalance(wallet.id);
  let balance = balanceFromDb ?? 0;
  let locked = lockedFromDb ?? 0;

  // lockedBalance (pendingTips) varsa claim dene; sync açıksa claim sonrası tekrar sync
  if (sdk.isConfigured() && locked > 0) {
    const userIdStr = String(userId);
    const tryClaim = async (): Promise<{ success: true } | { success: false; error: unknown }> => {
      try {
        await sdk.claim(userIdStr);
        return { success: true };
      } catch (err) {
        return { success: false, error: err };
      }
    };

    let attempt = await tryClaim();

    if (!attempt.success) {
      const errMsg = attempt.error instanceof Error ? attempt.error.message : String(attempt.error);
      const contractError = parseContractError(errMsg);
      if (contractError === CONTRACT_ERROR_NO_BADGE_OWNED) {
        const auth = await sdk.authenticateAndGetAddresses(userIdStr);
        const smartAccountAddress = auth.success ? auth.smartAccountAddress : undefined;
        if (smartAccountAddress) {
          const nftService = createWeb3NftService();
          const mintResult = await nftService.mintDefaultBadge(smartAccountAddress);
          if (mintResult.success) attempt = await tryClaim();
        }
      }
    }

    if (attempt.success) {
      await walletService.syncWalletBalanceFromChain(wallet.id);
      const after = await walletService.getBalance(wallet.id);
      balance = after.balance ?? 0;
      locked = after.lockedBalance ?? 0;
    }
  }

  const available = Math.max(0, balance - locked);

  return res.json({
    balance,
    currency: 'TIPS',
    locked,
    available,
    pendingTips: locked,
  });
}));

/**
 * @openapi
 * /api/wallets/balance/sync:
 *   post:
 *     summary: Contract'tan bakiye senkronize et (pull-to-refresh)
 *     description: Smart account adresindeki TIPS bakiyesini contract'tan okuyup DB'yi günceller.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Güncel bakiye
 *       404:
 *         description: Wallet bulunamadı
 */
router.post('/balance/sync', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const wallet = await walletService.getPreferredWalletForBalance(String(userId));
  if (!wallet) {
    return res.status(404).json({ success: false, message: 'No wallet found', balance: 0, currency: 'TIPS', locked: 0, available: 0 });
  }

  const sdk = getWalletProvider();
  if (!sdk.isConfigured()) {
    logger.warn({ userId, message: 'balance/sync: wallet provider yapılandırılmamış, DB değerleri dönülüyor' });
  } else if (!wallet.smartAccountAddress) {
    logger.warn({ walletId: wallet.id, message: 'balance/sync: smartAccountAddress yok, DB değerleri dönülüyor' });
  } else {
    const syncResult = await walletService.syncWalletBalanceFromChain(wallet.id);
    if (!syncResult.success) {
      logger.warn({ walletId: wallet.id, error: syncResult.error, message: 'balance/sync: chain sync başarısız, DB değerleri dönülüyor' });
    }
  }

  const { balance: balanceFromDb, lockedBalance: lockedFromDb } = await walletService.getBalance(wallet.id);
  const balance = balanceFromDb ?? 0;
  const locked = lockedFromDb ?? 0;
  const available = Math.max(0, balance - locked);

  return res.json({
    balance,
    currency: 'TIPS',
    locked,
    available,
    pendingTips: locked,
    synced: sdk.isConfigured() && !!wallet.smartAccountAddress,
  });
}));

/**
 * @openapi
 * /api/wallets/create:
 *   post:
 *     summary: Kullanıcı için yeni wallet oluştur (Thirdweb Wallet Connect zorunlu)
 *     description: |
 *       Wallet yalnızca Thirdweb üzerinden oluşturulur. Mock/sahte adres kullanılmaz.
 *       Kullanıcı önce uygulama içinde Thirdweb ile wallet connect yapmış olmalı.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Wallet başarıyla oluşturuldu (Thirdweb oturumu ile)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 walletId:
 *                   type: string
 *                 walletIdentifier:
 *                   type: string
 *                 balance:
 *                   type: number
 *       400:
 *         description: Thirdweb wallet oturumu yok; önce wallet connect yapılmalı
 *       503:
 *         description: Thirdweb yapılandırılmamış (THIRDWEB_CLIENT_ID/SECRET_KEY)
 */
router.post('/create', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Check if wallet already exists
  const existingWallet = await walletService.getActiveWallet(String(userId));
  if (existingWallet) {
    const balanceInfo = await walletService.getUserBalance(String(userId));
    return res.json({
      walletId: existingWallet.id,
      walletIdentifier: existingWallet.smartAccountAddress ?? existingWallet.publicAddress,
      balance: balanceInfo.balance
    });
  }

  try {
    // Wallet creation only via Thirdweb wallet connect (no mock/fake address)
    const wallet = await walletService.createWalletViaThirdweb(String(userId));
    const balanceInfo = await walletService.getUserBalance(String(userId));
    return res.status(201).json({
      walletId: wallet.id,
      walletIdentifier: wallet.smartAccountAddress ?? wallet.publicAddress,
      balance: balanceInfo.balance
    });
  } catch (err: unknown) {
    if (err instanceof WalletProviderNotConfiguredError) {
      return res.status(503).json({
        success: false,
        message: err.message,
        code: err.code,
      });
    }
    if (
      err instanceof Error &&
      (err.name === 'WalletProviderAuthFailedError' ||
        err.name === 'ThirdwebWalletAuthFailedError')
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    throw err;
  }
}));

/**
 * @openapi
 * /api/wallets/info:
 *   get:
 *     summary: Kullanıcının aktif wallet bilgilerini getir
 *     description: Kullanıcının aktif wallet'ının detaylı bilgilerini ve bakiyesini döndürür
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet bilgileri başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 walletId:
 *                   type: string
 *                   format: uuid
 *                   description: Wallet benzersiz kimliği
 *                   example: "123e4567-e89b-12d3-a456-426614174000"
 *                 walletIdentifier:
 *                   type: string
 *                   description: Wallet public adresi
 *                   example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *                 provider:
 *                   type: string
 *                   enum: [METAMASK, WALLET_CONNECT, COINBASE, CUSTOM]
 *                   description: Wallet sağlayıcısı
 *                   example: "METAMASK"
 *                 isConnected:
 *                   type: boolean
 *                   description: Wallet'ın bağlı olup olmadığı
 *                   example: true
 *                 balance:
 *                   type: number
 *                   description: Mevcut TIPS bakiyesi
 *                   example: 1250.5
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   description: Wallet oluşturulma tarihi
 *                   example: "2024-01-15T10:30:00.000Z"
 *             examples:
 *               success:
 *                 summary: Başarılı yanıt örneği
 *                 value:
 *                   walletId: "123e4567-e89b-12d3-a456-426614174000"
 *                   walletIdentifier: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *                   provider: "METAMASK"
 *                   isConnected: true
 *                   balance: 1250.5
 *                   createdAt: "2024-01-15T10:30:00.000Z"
 *       401:
 *         description: Kullanıcı doğrulaması başarısız
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       404:
 *         description: Aktif wallet bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Wallet not found"
 */
router.get('/info', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Cache kontrolü - Wallet info asla cache'lenmemeli
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const wallet = await walletService.getActiveWallet(String(userId));
  if (!wallet) {
    return res.status(404).json({ success: false, message: 'Wallet not found' });
  }

  const balanceInfo = await walletService.getUserBalance(String(userId));

  return res.json({
    walletId: wallet.id,
    walletIdentifier: wallet.smartAccountAddress,
    provider: wallet.provider,
    isConnected: wallet.isConnected,
    balance: balanceInfo.balance,
    createdAt: wallet.createdAt.toISOString()
  });
}));

/**
 * @openapi
 * /api/wallets/pending-tips/claim:
 *   post:
 *     summary: Pending tips claim et (contract)
 *     description: |
 *       Tipbox contract'taki bekleyen TIPS'leri Smart Account üzerinden claim eder.
 *       - Claim Thirdweb SDK (thirdweb-sdk.service) ile yapılır.
 *       - Contract **NoBadgeOwned** (badge hatası) dönerse, kullanıcının smartAccountAddress'ine
 *         Web3 NFT servisi ile badge mint edilir ve claim tekrar denenir.
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Claim başarılı (veya badge mint sonrası claim başarılı)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 eoaAddress:
 *                   type: string
 *                   nullable: true
 *                 smartAccountAddress:
 *                   type: string
 *                   nullable: true
 *                 receipt:
 *                   type: object
 *                   description: Transaction receipt
 *                 badgeMinted:
 *                   type: boolean
 *                   description: Bu denemede badge mint edilip sonra claim tekrarlandıysa true
 *       400:
 *         description: Claim başarısız (NoPendingTips vb.)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 contractError:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: Unauthorized
 *       502:
 *         description: Badge mint gerekli ama mint başarısız
 */
router.post('/pending-tips/claim', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const sdk = getWalletProvider();
  if (!sdk.isConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Wallet provider is not configured',
    });
  }

  const userIdStr = String(userId);

  const tryClaim = async (): Promise<{ success: true; result: Awaited<ReturnType<typeof sdk.claim>> } | { success: false; error: unknown }> => {
    try {
      const result = await sdk.claim(userIdStr);
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  let attempt = await tryClaim();

  if (attempt.success) {
    const providerWallet = await walletService.getActiveProviderWallet(userIdStr);
    if (providerWallet?.id) {
      walletService.syncWalletBalanceFromChain(providerWallet.id).catch((err) => {
        logger.warn({ userId: userIdStr, walletId: providerWallet.id, error: String(err), message: 'syncWalletBalanceFromChain after claim failed' });
      });
    }
    return res.status(200).json({
      success: true,
      eoaAddress: attempt.result.eoaAddress ?? null,
      smartAccountAddress: attempt.result.smartAccountAddress ?? null,
      receipt: attempt.result.receipt ?? undefined,
      badgeMinted: false,
    });
  }

  const errMsg = attempt.error instanceof Error ? attempt.error.message : String(attempt.error);
  const contractError = parseContractError(errMsg);

  if (contractError === CONTRACT_ERROR_NO_BADGE_OWNED) {
    const auth = await sdk.authenticateAndGetAddresses(userIdStr);
    const smartAccountAddress = auth.success ? auth.smartAccountAddress : undefined;

    if (smartAccountAddress) {
      logger.info({
        userId: userIdStr,
        smartAccountAddress,
        message: 'Pending tips claim failed with NoBadgeOwned; minting badge to smartAccountAddress',
      });

      const nftService = createWeb3NftService();
      const mintResult = await nftService.mintDefaultBadge(smartAccountAddress);

      if (!mintResult.success) {
        logger.error({
          userId: userIdStr,
          smartAccountAddress,
          error: mintResult.error,
          contractError: mintResult.contractError,
          message: 'Badge mint failed for pending-tips claim',
        });
        return res.status(502).json({
          success: false,
          error: mintResult.error ?? 'Badge mint failed',
          contractError: mintResult.contractError ?? undefined,
        });
      }

      attempt = await tryClaim();
      if (attempt.success) {
        const thirdwebWallet = await walletService.getThirdwebWallet(userIdStr);
        if (thirdwebWallet?.id) {
          walletService.syncWalletBalanceFromChain(thirdwebWallet.id).catch((err) => {
            logger.warn({ userId: userIdStr, walletId: thirdwebWallet.id, error: String(err), message: 'syncWalletBalanceFromChain after claim failed' });
          });
        }
        return res.status(200).json({
          success: true,
          eoaAddress: attempt.result.eoaAddress ?? null,
          smartAccountAddress: attempt.result.smartAccountAddress ?? null,
          receipt: attempt.result.receipt ?? undefined,
          badgeMinted: true,
        });
      }
    }
  }

  return res.status(400).json({
    success: false,
    error: errMsg,
    contractError: contractError ?? undefined,
  });
}));

/**
 * @openapi
 * /api/wallets/rewards/summary:
 *   get:
 *     summary: Kullanıcının claim edilebilir reward özetini getir
 *     description: Kullanıcının tüm claim edilebilir reward'larının özetini ve kaynaklarına göre gruplandırılmış bilgilerini döndürür
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reward özeti başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalPending:
 *                   type: integer
 *                   description: Bekleyen toplam reward sayısı
 *                 totalClaimable:
 *                   type: integer
 *                   description: Claim edilebilir reward sayısı
 *                 totalAmount:
 *                   type: number
 *                   description: Toplam claim edilebilir TIPS miktarı
 *                 bySourceType:
 *                   type: object
 *                   description: Kaynak tipine göre gruplandırılmış reward'lar
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       count:
 *                         type: integer
 *                       amount:
 *                         type: number
 *                       claims:
 *                         type: array
 *                         items:
 *                           type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/rewards/summary', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const summary = await rewardClaimService.getRewardClaimSummary(String(userId));
    return res.json(summary);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get reward summary',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}));

/**
 * @openapi
 * /api/wallets/rewards/claimable:
 *   get:
 *     summary: Kullanıcının claim edilebilir tüm reward'larını getir
 *     description: Kullanıcının claim edilebilir durumda olan tüm reward'ların detaylı listesini döndürür
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Claimable reward'lar başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   userId:
 *                     type: string
 *                   rewardType:
 *                     type: string
 *                     enum: [TIPS, BADGE, ACHIEVEMENT, LADDER, SUPPORT, EVENT]
 *                   sourceType:
 *                     type: string
 *                   amount:
 *                     type: number
 *                   status:
 *                     type: string
 *                   earnedAt:
 *                     type: string
 *                     format: date-time
 *                   expiresAt:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                   metadata:
 *                     type: object
 *                     nullable: true
 *       401:
 *         description: Unauthorized
 */
router.get('/rewards/claimable', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const rewards = await rewardClaimService.getClaimableRewards(String(userId));
    return res.json(rewards.map((r) => r.toDTO()));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get claimable rewards',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}));

/**
 * @openapi
 * /api/wallets/rewards/source/{sourceType}:
 *   get:
 *     summary: Belirli bir kaynaktan gelen reward'ları getir
 *     description: Kullanıcının belirtilen kaynak tipinden gelen claim edilebilir reward'larını getirir
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sourceType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [LADDER_REWARD, TIPS_RECEIVED, SUPPORT_SESSION, BADGE_EARNED, ACHIEVEMENT_UNLOCKED, EVENT_PARTICIPATION]
 *         description: Reward kaynak tipi
 *     responses:
 *       200:
 *         description: Kaynak tipine göre reward'lar başarıyla getirildi
 *       400:
 *         description: Invalid source type
 *       401:
 *         description: Unauthorized
 */
router.get('/rewards/source/:sourceType', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { sourceType } = req.params;

  try {
    const rewards = await rewardClaimService.getRewardsBySourceType(
      String(userId),
      sourceType as RewardSourceType
    );
    return res.json(rewards.map((r) => r.toDTO()));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get rewards by source type',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}));

/**
 * @openapi
 * /api/wallets/rewards/claim/{rewardId}:
 *   post:
 *     summary: Belirli bir reward'ı claim et
 *     description: Kullanıcının belirtilen reward'ını claim eder ve wallet'a ekler
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rewardId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Claim edilecek reward ID'si
 *     responses:
 *       200:
 *         description: Reward başarıyla claim edildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 rewardClaim:
 *                   type: object
 *                 transactionId:
 *                   type: string
 *       400:
 *         description: Reward claim edilemez
 *       404:
 *         description: Reward bulunamadı
 *       401:
 *         description: Unauthorized
 */
router.post('/rewards/claim/:rewardId', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { rewardId } = req.params;

  try {
    const result = await rewardClaimService.claimReward(String(userId), rewardId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    return res.json({
      success: true,
      rewardClaim: result.rewardClaim?.toDTO(),
      transactionId: result.transactionId,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}));

/**
 * @openapi
 * /api/wallets/rewards/claim-all:
 *   post:
 *     summary: Tüm claim edilebilir reward'ları tek seferde claim et
 *     description: Kullanıcının tüm claim edilebilir reward'larını tek bir transaction ile claim eder
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reward'lar başarıyla claim edildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 totalAmount:
 *                   type: number
 *                   description: Claim edilen toplam miktar
 *                 claimedCount:
 *                   type: integer
 *                   description: Başarıyla claim edilen reward sayısı
 *                 failedCount:
 *                   type: integer
 *                   description: Claim edilemeyen reward sayısı
 *                 transactionId:
 *                   type: string
 *                 claims:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 */
router.post('/rewards/claim-all', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const result = await rewardClaimService.claimAllRewards(String(userId));

    return res.json({
      success: result.success,
      totalAmount: result.totalAmount,
      claimedCount: result.claimedCount,
      failedCount: result.failedCount,
      transactionId: result.transactionId,
      claims: result.claims.map((c) => c.toDTO()),
      errors: result.errors,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}));

/**
 * @openapi
 * /api/wallets/rewards/history:
 *   get:
 *     summary: Kullanıcının claim history'sini getir
 *     description: Kullanıcının daha önce claim ettiği tüm reward'ların geçmişini döndürür
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Claim history başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/rewards/history', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const history = await rewardClaimService.getClaimHistory(String(userId));
    return res.json(history.map((r) => r.toDTO()));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get claim history',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}));

export default router;