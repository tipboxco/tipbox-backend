import express, { Request, Response } from 'express';
import { WalletService } from '../../application/wallet/wallet.service';
import { ConnectWalletRequest, WalletResponse } from './wallet.dto';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { WalletProvider } from '../../domain/wallet/wallet.entity';

const router = express.Router();
const walletService = new WalletService();

/**
 * @openapi
 * /wallets:
 *   get:
 *     summary: Kullanıcının cüzdanlarını listele
 *     description: Giriş yapan kullanıcının tüm bağlı cüzdanlarını listeler
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cüzdan listesi başarıyla getirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "01J9Y4NQSW3KZV9W0F7B6C2D1E"
 *                     description: Cüzdanın benzersiz ID'si
 *                   userId:
 *                     type: string
 *                     example: "01J9Y4NQSW3KZV9W0F7B6C2D1E"
 *                     description: Cüzdanın sahibi olan kullanıcının ID'si
 *                   publicAddress:
 *                     type: string
 *                     example: 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6
 *                     description: Cüzdanın public adresi
 *                   provider:
 *                     type: string
 *                     enum: [METAMASK, WALLETCONNECT, COINBASE, PHANTOM, TRUSTWALLET]
 *                     example: METAMASK
 *                     description: Cüzdan sağlayıcısı
 *                   isConnected:
 *                     type: boolean
 *                     example: true
 *                     description: Cüzdanın bağlı olup olmadığı
 *                   shortAddress:
 *                     type: string
 *                     example: 0x742d...8b6
 *                     description: Kısaltılmış cüzdan adresi
 *                   providerIcon:
 *                     type: string
 *                     example: https://cdn.tipbox.com/icons/metamask.svg
 *                     description: Cüzdan sağlayıcısının ikon URL'si
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-01-15T10:30:00.000Z"
 *                     description: Cüzdan bağlanma tarihi
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                     example: "2024-01-15T10:30:00.000Z"
 *                     description: Son güncelleme tarihi
 *       401:
 *         description: Yetkisiz erişim
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Geçersiz token
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Cüzdanlar listelenirken bir hata oluştu
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  // TODO: Get userId from JWT token
  const userId = String(req.headers['user-id'] || '');
  
  const wallets = await walletService.getUserWallets(userId);
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

  res.json(response);
}));

/**
 * @openapi
 * /wallets/active:
 *   get:
 *     summary: Get user's active wallet
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active wallet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletResponse'
 *       404:
 *         description: No active wallet found
 */
router.get('/active', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.headers['user-id'] || '');
  
  const activeWallet = await walletService.getActiveWallet(userId);
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

  res.json(response);
}));

/**
 * @openapi
 * /wallets/connect:
 *   post:
 *     summary: Yeni cüzdan bağla
 *     description: Kullanıcıya yeni bir cüzdan bağlar ve aktif hale getirir
 *     tags: [Wallets]
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
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6
 *                 description: Bağlanacak cüzdanın public adresi (Ethereum format)
 *               provider:
 *                 type: string
 *                 enum: [METAMASK, WALLETCONNECT, COINBASE, PHANTOM, TRUSTWALLET]
 *                 example: METAMASK
 *                 description: Cüzdan sağlayıcısı
 *     responses:
 *       201:
 *         description: Cüzdan başarıyla bağlandı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "01J9Y4NQSW3KZV9W0F7B6C2D1E"
 *                   description: Bağlanan cüzdanın benzersiz ID'si
 *                 userId:
 *                   type: string
 *                   example: "01J9Y4NQSW3KZV9W0F7B6C2D1E"
 *                   description: Cüzdanın sahibi olan kullanıcının ID'si
 *                 publicAddress:
 *                   type: string
 *                   example: 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6
 *                   description: Cüzdanın public adresi
 *                 provider:
 *                   type: string
 *                   example: METAMASK
 *                   description: Cüzdan sağlayıcısı
 *                 isConnected:
 *                   type: boolean
 *                   example: true
 *                   description: Cüzdanın bağlı durumu
 *                 shortAddress:
 *                   type: string
 *                   example: 0x742d...8b6
 *                   description: Kısaltılmış cüzdan adresi
 *                 providerIcon:
 *                   type: string
 *                   example: https://cdn.tipbox.com/icons/metamask.svg
 *                   description: Cüzdan sağlayıcısının ikon URL'si
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                   description: Cüzdan bağlanma tarihi
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                   description: Son güncelleme tarihi
 *       400:
 *         description: Geçersiz cüzdan adresi veya sağlayıcı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Geçersiz cüzdan adresi formatı
 *       401:
 *         description: Yetkisiz erişim
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Geçersiz token
 *       409:
 *         description: Cüzdan zaten bağlı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Bu cüzdan adresi zaten bağlı
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Cüzdan bağlanırken bir hata oluştu
 */
router.post('/connect', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.headers['user-id'] || '');
  const { publicAddress, provider }: ConnectWalletRequest = req.body;

  // Validation
  if (!walletService.validateWalletAddress(publicAddress)) {
    return res.status(400).json({ message: 'Invalid wallet address format' });
  }

  if (!Object.values(WalletProvider).includes(provider as WalletProvider)) {
    return res.status(400).json({ message: 'Invalid wallet provider' });
  }

  const wallet = await walletService.connectWallet(userId, publicAddress, provider as WalletProvider);
  
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

  res.status(201).json(response);
}));

/**
 * @openapi
 * /wallets/{id}/disconnect:
 *   patch:
 *     summary: Disconnect a wallet
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Wallet disconnected successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletResponse'
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

  res.json(response);
}));

/**
 * @openapi
 * /wallets/{id}/activate:
 *   patch:
 *     summary: Activate a wallet (set as primary)
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Wallet activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletResponse'
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

  res.json(response);
}));

/**
 * @openapi
 * /wallets/{id}:
 *   delete:
 *     summary: Remove a wallet
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Wallet removed successfully
 *       404:
 *         description: Wallet not found
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const walletId = req.params.id;
  
  const deleted = await walletService.removeWallet(walletId);
  if (!deleted) {
    return res.status(404).json({ message: 'Wallet not found' });
  }

  res.status(204).send();
}));

export default router;