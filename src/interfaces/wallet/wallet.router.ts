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
 *     summary: Get user's wallets
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user wallets
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WalletResponse'
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  // TODO: Get userId from JWT token
  const userId = parseInt(req.headers['user-id'] as string) || 1;
  
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
  const userId = parseInt(req.headers['user-id'] as string) || 1;
  
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
 *     summary: Connect a new wallet
 *     tags: [Wallets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConnectWalletRequest'
 *     responses:
 *       201:
 *         description: Wallet connected successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletResponse'
 *       400:
 *         description: Invalid wallet address or provider
 */
router.post('/connect', asyncHandler(async (req: Request, res: Response) => {
  const userId = parseInt(req.headers['user-id'] as string) || 1;
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
 *           type: integer
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
  const walletId = parseInt(req.params.id);
  
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
 *           type: integer
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
  const walletId = parseInt(req.params.id);
  
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
 *           type: integer
 *     responses:
 *       204:
 *         description: Wallet removed successfully
 *       404:
 *         description: Wallet not found
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const walletId = parseInt(req.params.id);
  
  const deleted = await walletService.removeWallet(walletId);
  if (!deleted) {
    return res.status(404).json({ message: 'Wallet not found' });
  }

  res.status(204).send();
}));

export default router;