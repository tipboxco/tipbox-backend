import express, { Request, Response } from 'express';
import { WalletService } from '../../application/wallet/wallet.service';
import { TipsBalanceService } from '../../application/wallet/tips-balance.service';
import { TransactionService } from '../../application/transaction/transaction.service';
import { ConnectWalletRequest, WalletResponse } from './wallet.dto';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { WalletProvider } from '../../domain/wallet/wallet.entity';
import { authMiddleware } from '../auth/auth.middleware';

const router = express.Router();
const walletService = new WalletService();
const tipsBalanceService = new TipsBalanceService();
const transactionService = new TransactionService();

router.use(authMiddleware);

/**
 * @openapi
 * /wallets:
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

/**
 * @openapi
 * /wallets/active:
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

/**
 * @openapi
 * /wallets/connect:
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

/**
 * @openapi
 * /wallets/{id}/disconnect:
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

/**
 * @openapi
 * /wallets/{id}/activate:
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

/**
 * @openapi
 * /wallets/{id}:
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
    const balance = await transactionService.getUserBalance(String(userId));
    
    return res.json({
      balance,
      currency: 'TIPS',
      locked: 0,
      available: balance,
    });
  } catch (error) {
    return res.status(500).json({ 
      message: 'Failed to get balance',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}));

/**
 * @openapi
 * /wallets/create:
 *   post:
 *     summary: Kullanıcı için yeni wallet oluştur
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Wallet başarıyla oluşturuldu
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
 *         description: Wallet zaten mevcut
 */
router.post('/create', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Check if wallet already exists
  const existingWallet = await walletService.getActiveWallet(String(userId));
  if (existingWallet) {
    const balance = await transactionService.getUserBalance(String(userId));
    return res.json({
      walletId: existingWallet.id,
      walletIdentifier: existingWallet.publicAddress,
      balance
    });
  }

  // Create new wallet with fake address for Web2
  const fakeAddress = `0xTIPBOX_${userId}_${Date.now()}`;
  const wallet = await walletService.connectWallet(
    String(userId),
    fakeAddress,
    WalletProvider.CUSTOM
  );

  return res.status(201).json({
    walletId: wallet.id,
    walletIdentifier: wallet.publicAddress,
    balance: 0
  });
}));

/**
 * @openapi
 * /wallets/info:
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
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const wallet = await walletService.getActiveWallet(String(userId));
  if (!wallet) {
    return res.status(404).json({ message: 'Wallet not found' });
  }

  const balance = await transactionService.getUserBalance(String(userId));

  return res.json({
    walletId: wallet.id,
    walletIdentifier: wallet.publicAddress,
    provider: wallet.provider,
    isConnected: wallet.isConnected,
    balance,
    createdAt: wallet.createdAt.toISOString()
  });
}));

export default router;