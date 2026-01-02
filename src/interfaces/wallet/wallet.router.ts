import express, { Request, Response } from 'express';
import { WalletService } from '../../application/wallet/wallet.service';
import { TipsBalanceService } from '../../application/wallet/tips-balance.service';
import { ConnectWalletRequest, WalletResponse } from './wallet.dto';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { WalletProvider } from '../../domain/wallet/wallet.entity';
import { authMiddleware } from '../auth/auth.middleware';

const router = express.Router();
const walletService = new WalletService();
const tipsBalanceService = new TipsBalanceService();

router.use(authMiddleware);

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const wallets = await walletService.getUserWallets(String(userId));
  const response: WalletResponse[] = wallets.map(wallet => ({
    id: wallet.id,
    userId: wallet.userId,
    publicAddress: wallet.publicAddress,
    provider: wallet.provider,
    isConnected: wallet.isConnected,
    shortAddress: wallet.getShortAddress(),
    providerIcon: wallet.getProviderIcon(),
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString()
  }));

  return res.json(response);
}));

router.get('/active', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const activeWallet = await walletService.getActiveWallet(String(userId));
  if (!activeWallet) {
    return res.status(404).json({ message: 'No active wallet found' });
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

router.post('/connect', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const { publicAddress, provider }: ConnectWalletRequest = req.body;

  // Validation
  if (!walletService.validateWalletAddress(publicAddress)) {
    return res.status(400).json({ message: 'Invalid wallet address format' });
  }

  if (!Object.values(WalletProvider).includes(provider as WalletProvider)) {
    return res.status(400).json({ message: 'Invalid wallet provider' });
  }

  const wallet = await walletService.connectWallet(String(userId), publicAddress, provider as WalletProvider);
  
  const response: WalletResponse = {
    id: wallet.id,
    userId: wallet.userId,
    publicAddress: wallet.publicAddress,
    provider: wallet.provider,
    isConnected: wallet.isConnected,
    shortAddress: wallet.getShortAddress(),
    providerIcon: wallet.getProviderIcon(),
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString()
  };

  return res.status(201).json(response);
}));

router.patch('/:id/disconnect', asyncHandler(async (req: Request, res: Response) => {
  const walletId = req.params.id;
  
  const wallet = await walletService.disconnectWallet(walletId);
  if (!wallet) {
    return res.status(404).json({ message: 'Wallet not found' });
  }

  const response: WalletResponse = {
    id: wallet.id,
    userId: wallet.userId,
    publicAddress: wallet.publicAddress,
    provider: wallet.provider,
    isConnected: wallet.isConnected,
    shortAddress: wallet.getShortAddress(),
    providerIcon: wallet.getProviderIcon(),
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString()
  };

  return res.json(response);
}));

router.patch('/:id/activate', asyncHandler(async (req: Request, res: Response) => {
  const walletId = req.params.id;
  
  const wallet = await walletService.switchActiveWallet(walletId);
  if (!wallet) {
    return res.status(404).json({ message: 'Wallet not found' });
  }

  const response: WalletResponse = {
    id: wallet.id,
    userId: wallet.userId,
    publicAddress: wallet.publicAddress,
    provider: wallet.provider,
    isConnected: wallet.isConnected,
    shortAddress: wallet.getShortAddress(),
    providerIcon: wallet.getProviderIcon(),
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString()
  };

  return res.json(response);
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const walletId = req.params.id;
  
  const deleted = await walletService.removeWallet(walletId);
  if (!deleted) {
    return res.status(404).json({ message: 'Wallet not found' });
  }

  return res.status(204).send();
}));

/**
 * @openapi
 * /wallets/transactions:
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
 *                         description: İşlem nedeni (örn: "Post beğenisi", "Expert sorusu", "TIPS gönderimi")
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
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const cursor = req.query.cursor as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

  if (limit < 1 || limit > 50) {
    return res.status(400).json({ message: 'Limit must be between 1 and 50' });
  }

  try {
    const transactions = await tipsBalanceService.getUserTransactionHistory(String(userId), {
      cursor,
      limit,
    });

    return res.json({
      items: transactions.items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
      pagination: {
        cursor: transactions.cursor || null,
        hasMore: transactions.hasMore,
        limit,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to get transactions',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}));

/**
 * @openapi
 * /wallets/balance:
 *   get:
 *     summary: Kullanıcının TIPS balance'ını getir
 *     description: Kullanıcının mevcut TIPS bakiyesini döndürür
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Balance başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: number
 *                   description: Mevcut TIPS bakiyesi
 *                 currency:
 *                   type: string
 *                   default: "TIPS"
 *                 locked:
 *                   type: number
 *                   default: 0
 *                   description: Kilitli TIPS miktarı
 *                 available:
 *                   type: number
 *                   description: Kullanılabilir TIPS miktarı (balance - locked)
 *       401:
 *         description: Unauthorized
 */
router.get('/balance', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const balance = await tipsBalanceService.getUserTipsBalance(String(userId));
    
    return res.json({
      balance,
      currency: 'TIPS',
      locked: 0, // Şimdilik 0, ileride locked balance eklenebilir
      available: balance,
    });
  } catch (error) {
    return res.status(500).json({ 
      message: 'Failed to get balance',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}));

export default router;