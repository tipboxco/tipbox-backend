import express, { Request, Response } from 'express';
import { WalletService } from '../../application/wallet/wallet.service';
import { TipsBalanceService } from '../../application/wallet/tips-balance.service';
import { TransactionService } from '../../application/transaction/transaction.service';
import { RewardClaimService } from '../../application/reward/reward-claim.service';
import { 
  ConnectWalletRequest, 
  WalletResponse, 
  ThirdwebAuthenticateResponse,
  WalletBalancesResponse,
  WalletNftsResponse,
  TransferTokenRequest,
  TransferNftRequest,
  TransferResponse,
  ChainConfigResponse,
} from './wallet.dto';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { WalletProvider } from '../../domain/wallet/wallet.entity';
import { authMiddleware } from '../auth/auth.middleware';
import { getThirdwebWalletService } from '../../infrastructure/thirdweb/thirdweb-wallet.service';
import logger from '../../infrastructure/logger/logger';

const router = express.Router();
const walletService = new WalletService();
const tipsBalanceService = new TipsBalanceService();
const transactionService = new TransactionService();
const rewardClaimService = new RewardClaimService();
const thirdwebWalletService = getThirdwebWalletService();

router.use(authMiddleware);

/**
 * @openapi
 * /wallets/thirdweb/authenticate:
 *   post:
 *     summary: Kullanıcı için Thirdweb embedded wallet oluştur/al
 *     description: |
 *       Kullanıcı ID'si ile Thirdweb API'ye bağlanarak embedded wallet oluşturur.
 *       Eğer kullanıcının zaten bir Thirdweb wallet'ı varsa, mevcut wallet'ı döndürür.
 *       
 *       Her zaman hem EOA (EIP-7702) hem de Smart Account (ERC-4337) adresi döndürülür.
 *       
 *       Thirdweb Custom Auth-Payload Authentication kullanılır:
 *       - https://portal.thirdweb.com/wallets/custom-authentication
 *     tags: [Wallet, Thirdweb]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: chainId
 *         schema:
 *           type: integer
 *         description: Chain ID (varsayılan THIRDWEB_DEFAULT_CHAIN_ID env'den alınır)
 *     responses:
 *       200:
 *         description: Thirdweb wallet başarıyla oluşturuldu/alındı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 isNewUser:
 *                   type: boolean
 *                   description: Thirdweb'de yeni kullanıcı mı (ilk kez wallet oluşturuldu mu)
 *                   example: false
 *                 walletAddress:
 *                   type: string
 *                   description: EIP-7702 EOA wallet adresi
 *                   example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *                 smartAccountAddress:
 *                   type: string
 *                   description: ERC-4337 Smart Account adresi
 *                   example: "0x8A3d35Cc6634C0532925a3b844Bc9e7595f0cDa"
 *                 wallet:
 *                   $ref: '#/components/schemas/WalletResponse'
 *       401:
 *         description: Unauthorized - Kullanıcı doğrulanamadı
 *       500:
 *         description: Thirdweb authentication hatası
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
 *                   example: "Thirdweb authentication is not configured"
 */
router.post('/thirdweb/authenticate', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  logger.info({
    userId: String(userId),
    message: 'Thirdweb authentication isteği alındı',
  });

  try {
    // Chain ID (opsiyonel - varsayılan .env'den alınır)
    const chainId = req.query.chainId ? parseInt(req.query.chainId as string, 10) : undefined;

    // Her zaman EOA + Smart Account adresi al
    const result = await walletService.authenticateWithThirdweb(String(userId), {
      includeSmartAccount: true,
      chainId,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      } as ThirdwebAuthenticateResponse);
    }

    const wallet = result.wallet!;
    const response: ThirdwebAuthenticateResponse = {
      success: true,
      isNewUser: result.isNewUser,
      walletAddress: result.walletAddress,
      smartAccountAddress: result.smartAccountAddress,
      wallet: {
        id: wallet.id,
        userId: wallet.userId,
        publicAddress: wallet.publicAddress,
        smartAccountAddress: wallet.smartAccountAddress,
        provider: wallet.provider as 'METAMASK' | 'WALLETCONNECT' | 'CUSTOM' | 'THIRDWEB',
        isConnected: wallet.isConnected,
        balance: wallet.balance,
        lockedBalance: wallet.lockedBalance,
        shortAddress: wallet.getShortAddress(),
        shortSmartAccountAddress: wallet.getShortSmartAccountAddress(),
        providerIcon: wallet.getProviderIcon(),
        createdAt: wallet.createdAt.toISOString(),
        updatedAt: wallet.updatedAt.toISOString(),
      },
    };

    return res.json(response);
  } catch (error) {
    logger.error({
      userId: String(userId),
      error: error instanceof Error ? error.message : String(error),
      message: 'Thirdweb authentication endpoint hatası',
    });

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    } as ThirdwebAuthenticateResponse);
  }
}));

/**
 * @openapi
 * /wallets/thirdweb/status:
 *   get:
 *     summary: Thirdweb yapılandırma durumunu kontrol et
 *     description: Thirdweb API entegrasyonunun düzgün yapılandırılıp yapılandırılmadığını kontrol eder
 *     tags: [Wallet, Thirdweb]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Yapılandırma durumu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasClientId:
 *                   type: boolean
 *                   description: THIRDWEB_CLIENT_ID ayarlanmış mı
 *                 hasSecretKey:
 *                   type: boolean
 *                   description: THIRDWEB_SECRET_KEY ayarlanmış mı
 *                 hasEcosystemId:
 *                   type: boolean
 *                   description: THIRDWEB_ECOSYSTEM_ID ayarlanmış mı
 *                 isReady:
 *                   type: boolean
 *                   description: Thirdweb entegrasyonu kullanıma hazır mı
 */
router.get('/thirdweb/status', asyncHandler(async (req: Request, res: Response) => {
  const status = walletService.getThirdwebConfigStatus();
  return res.json(status);
}));

/**
 * @openapi
 * /wallets/thirdweb:
 *   get:
 *     summary: Kullanıcının Thirdweb wallet'ını getir
 *     description: Kullanıcının Thirdweb embedded wallet bilgilerini döndürür
 *     tags: [Wallet, Thirdweb]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thirdweb wallet bilgileri
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletResponse'
 *       404:
 *         description: Thirdweb wallet bulunamadı
 */
router.get('/thirdweb', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const wallet = await walletService.getThirdwebWallet(String(userId));

  if (!wallet) {
    return res.status(404).json({ message: 'Thirdweb wallet not found' });
  }

  const response: WalletResponse = {
    id: wallet.id,
    userId: wallet.userId,
    publicAddress: wallet.publicAddress,
    provider: wallet.provider as 'METAMASK' | 'WALLETCONNECT' | 'CUSTOM' | 'THIRDWEB',
    isConnected: wallet.isConnected,
    balance: wallet.balance,
    lockedBalance: wallet.lockedBalance,
    shortAddress: wallet.getShortAddress(),
    providerIcon: wallet.getProviderIcon(),
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
  };

  return res.json(response);
}));

/**
 * @openapi
 * /wallets/thirdweb/balances:
 *   get:
 *     summary: Thirdweb wallet bakiyelerini getir (native + ERC20)
 *     description: |
 *       Kullanıcının Thirdweb embedded wallet'ındaki native token ve ERC20 token bakiyelerini getirir.
 *     tags: [Wallet, Thirdweb]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: chainId
 *         schema:
 *           type: integer
 *         description: Chain ID (varsayılan Polygon - 137)
 *     responses:
 *       200:
 *         description: Bakiyeler başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletBalancesResponse'
 *       404:
 *         description: Thirdweb wallet bulunamadı
 */
router.get('/thirdweb/balances', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const wallet = await walletService.getThirdwebWallet(String(userId));
  if (!wallet) {
    return res.status(404).json({ success: false, error: 'Thirdweb wallet not found' });
  }

  const chainId = req.query.chainId ? parseInt(req.query.chainId as string, 10) : undefined;
  const result = await thirdwebWalletService.getWalletBalance(wallet.publicAddress, chainId);

  return res.json(result as WalletBalancesResponse);
}));

/**
 * @openapi
 * /wallets/thirdweb/nfts:
 *   get:
 *     summary: Thirdweb wallet NFT'lerini getir
 *     description: Kullanıcının Thirdweb embedded wallet'ındaki NFT'leri listeler
 *     tags: [Wallet, Thirdweb]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: chainId
 *         schema:
 *           type: integer
 *         description: Chain ID (varsayılan Polygon - 137)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maksimum NFT sayısı
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor
 *     responses:
 *       200:
 *         description: NFT'ler başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletNftsResponse'
 *       404:
 *         description: Thirdweb wallet bulunamadı
 */
router.get('/thirdweb/nfts', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const wallet = await walletService.getThirdwebWallet(String(userId));
  if (!wallet) {
    return res.status(404).json({ success: false, error: 'Thirdweb wallet not found' });
  }

  const chainId = req.query.chainId ? parseInt(req.query.chainId as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const cursor = req.query.cursor as string | undefined;

  const result = await thirdwebWalletService.getWalletNfts(
    wallet.publicAddress, 
    chainId, 
    { limit, cursor }
  );

  return res.json(result as WalletNftsResponse);
}));

/**
 * @openapi
 * /wallets/thirdweb/nfts/collection/{collectionAddress}:
 *   get:
 *     summary: Belirli bir koleksiyondaki NFT'leri getir
 *     tags: [Wallet, Thirdweb]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collectionAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: NFT koleksiyon contract adresi
 *       - in: query
 *         name: chainId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Koleksiyon NFT'leri
 *       404:
 *         description: Wallet bulunamadı
 */
router.get('/thirdweb/nfts/collection/:collectionAddress', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const wallet = await walletService.getThirdwebWallet(String(userId));
  if (!wallet) {
    return res.status(404).json({ success: false, error: 'Thirdweb wallet not found' });
  }

  const { collectionAddress } = req.params;
  const chainId = req.query.chainId ? parseInt(req.query.chainId as string, 10) : undefined;

  const result = await thirdwebWalletService.getNftsFromCollection(
    wallet.publicAddress,
    collectionAddress,
    chainId
  );

  return res.json(result as WalletNftsResponse);
}));

/**
 * @openapi
 * /wallets/thirdweb/token/{tokenAddress}/balance:
 *   get:
 *     summary: Belirli bir ERC20 token bakiyesini getir
 *     tags: [Wallet, Thirdweb]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tokenAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: ERC20 token contract adresi
 *       - in: query
 *         name: chainId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Token bakiyesi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenBalanceResponse'
 *       404:
 *         description: Wallet veya token bulunamadı
 */
router.get('/thirdweb/token/:tokenAddress/balance', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const wallet = await walletService.getThirdwebWallet(String(userId));
  if (!wallet) {
    return res.status(404).json({ error: 'Thirdweb wallet not found' });
  }

  const { tokenAddress } = req.params;
  const chainId = req.query.chainId ? parseInt(req.query.chainId as string, 10) : undefined;

  const result = await thirdwebWalletService.getTokenBalance(
    wallet.publicAddress,
    tokenAddress,
    chainId
  );

  if (!result) {
    return res.status(404).json({ error: 'Token not found or no balance' });
  }

  return res.json(result);
}));

/**
 * @openapi
 * /wallets/thirdweb/transfer/token:
 *   post:
 *     summary: ERC20 token transfer et
 *     description: |
 *       Kullanıcının Thirdweb wallet'ından ERC20 token transfer eder.
 *       NOT: Bu işlem server wallet üzerinden yapılır.
 *     tags: [Wallet, Thirdweb]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransferTokenRequest'
 *     responses:
 *       200:
 *         description: Transfer başarılı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransferResponse'
 *       400:
 *         description: Geçersiz istek
 *       404:
 *         description: Wallet bulunamadı
 */
router.post('/thirdweb/transfer/token', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const wallet = await walletService.getThirdwebWallet(String(userId));
  if (!wallet) {
    return res.status(404).json({ success: false, error: 'Thirdweb wallet not found' });
  }

  const { toAddress, tokenContractAddress, amount, chainId }: TransferTokenRequest = req.body;

  if (!toAddress || !tokenContractAddress || !amount) {
    return res.status(400).json({ 
      success: false, 
      error: 'toAddress, tokenContractAddress and amount are required' 
    });
  }

  const result = await thirdwebWalletService.transferToken(
    wallet.publicAddress,
    toAddress,
    tokenContractAddress,
    amount,
    chainId
  );

  return res.json(result as TransferResponse);
}));

/**
 * @openapi
 * /wallets/thirdweb/transfer/nft:
 *   post:
 *     summary: NFT transfer et
 *     description: |
 *       Kullanıcının Thirdweb wallet'ından NFT transfer eder.
 *       ERC721 ve ERC1155 desteklenir.
 *     tags: [Wallet, Thirdweb]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransferNftRequest'
 *     responses:
 *       200:
 *         description: Transfer başarılı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransferResponse'
 *       400:
 *         description: Geçersiz istek
 *       404:
 *         description: Wallet bulunamadı
 */
router.post('/thirdweb/transfer/nft', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const wallet = await walletService.getThirdwebWallet(String(userId));
  if (!wallet) {
    return res.status(404).json({ success: false, error: 'Thirdweb wallet not found' });
  }

  const { 
    toAddress, 
    nftContractAddress, 
    tokenId, 
    tokenType = 'ERC721', 
    amount, 
    chainId 
  }: TransferNftRequest = req.body;

  if (!toAddress || !nftContractAddress || !tokenId) {
    return res.status(400).json({ 
      success: false, 
      error: 'toAddress, nftContractAddress and tokenId are required' 
    });
  }

  const result = await thirdwebWalletService.transferNft(
    wallet.publicAddress,
    toAddress,
    nftContractAddress,
    tokenId,
    chainId,
    tokenType,
    amount
  );

  return res.json(result as TransferResponse);
}));

/**
 * @openapi
 * /wallets/thirdweb/disconnect:
 *   post:
 *     summary: Thirdweb wallet'ı disconnect et
 *     description: |
 *       Kullanıcının Thirdweb wallet bağlantısını keser.
 *       NOT: Embedded wallet blockchain'den silinmez, sadece uygulama oturumu sonlanır.
 *     tags: [Wallet, Thirdweb]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Disconnect başarılı
 *       404:
 *         description: Wallet bulunamadı
 */
router.post('/thirdweb/disconnect', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const wallet = await walletService.getThirdwebWallet(String(userId));
  if (!wallet) {
    return res.status(404).json({ success: false, error: 'Thirdweb wallet not found' });
  }

  // Thirdweb servisinde disconnect (şu an sadece log)
  await thirdwebWalletService.disconnectWallet(wallet.publicAddress);

  // DB'de wallet'ı disconnect olarak işaretle
  const disconnectedWallet = await walletService.disconnectWallet(wallet.id);

  logger.info({
    userId: String(userId),
    walletId: wallet.id,
    walletAddress: wallet.publicAddress,
    message: 'Thirdweb wallet disconnected',
  });

  return res.json({
    success: true,
    message: 'Wallet disconnected successfully',
    wallet: disconnectedWallet ? {
      id: disconnectedWallet.id,
      isConnected: disconnectedWallet.isConnected,
    } : null,
  });
}));

/**
 * @openapi
 * /wallets/thirdweb/chains:
 *   get:
 *     summary: Desteklenen blockchain listesini getir
 *     tags: [Wallet, Thirdweb]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Desteklenen chain'ler
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ChainConfigResponse'
 */
router.get('/thirdweb/chains', asyncHandler(async (req: Request, res: Response) => {
  const chains = thirdwebWalletService.getSupportedChains();
  
  const response: ChainConfigResponse[] = chains.map(chain => ({
    chainId: chain.chainId,
    name: chain.name,
    nativeCurrency: chain.nativeCurrency,
    blockExplorerUrl: chain.blockExplorerUrl,
  }));

  return res.json(response);
}));

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

  // Cache kontrolü - Transaction history asla cache'lenmemeli
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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

  // Cache kontrolü - Balance asla cache'lenmemeli
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const balanceInfo = await walletService.getUserBalance(String(userId));

    return res.json({
      balance: balanceInfo.balance,
      currency: 'TIPS',
      locked: balanceInfo.lockedBalance,
      available: balanceInfo.available,
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
    const balanceInfo = await walletService.getUserBalance(String(userId));
    return res.json({
      walletId: existingWallet.id,
      walletIdentifier: existingWallet.publicAddress,
      balance: balanceInfo.balance
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

  // Cache kontrolü - Wallet info asla cache'lenmemeli
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const wallet = await walletService.getActiveWallet(String(userId));
  if (!wallet) {
    return res.status(404).json({ message: 'Wallet not found' });
  }

  const balanceInfo = await walletService.getUserBalance(String(userId));

  return res.json({
    walletId: wallet.id,
    walletIdentifier: wallet.publicAddress,
    provider: wallet.provider,
    isConnected: wallet.isConnected,
    balance: balanceInfo.balance,
    createdAt: wallet.createdAt.toISOString()
  });
}));

/**
 * @openapi
 * /wallets/rewards/summary:
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
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const summary = await rewardClaimService.getRewardClaimSummary(String(userId));
    return res.json(summary);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to get reward summary',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}));

/**
 * @openapi
 * /wallets/rewards/claimable:
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
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const rewards = await rewardClaimService.getClaimableRewards(String(userId));
    return res.json(rewards.map((r) => r.toDTO()));
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to get claimable rewards',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}));

/**
 * @openapi
 * /wallets/rewards/source/{sourceType}:
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
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { sourceType } = req.params;

  try {
    const rewards = await rewardClaimService.getRewardsBySourceType(
      String(userId),
      sourceType as any
    );
    return res.json(rewards.map((r) => r.toDTO()));
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to get rewards by source type',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}));

/**
 * @openapi
 * /wallets/rewards/claim/{rewardId}:
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
    return res.status(401).json({ message: 'Unauthorized' });
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
 * /wallets/rewards/claim-all:
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
    return res.status(401).json({ message: 'Unauthorized' });
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
 * /wallets/rewards/history:
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
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const history = await rewardClaimService.getClaimHistory(String(userId));
    return res.json(history.map((r) => r.toDTO()));
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to get claim history',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}));

export default router;