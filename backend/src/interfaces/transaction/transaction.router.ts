import express, { Request, Response } from 'express';
import { TransactionService } from '../../application/transaction/transaction.service';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';

const router = express.Router();
const transactionService = new TransactionService();

router.use(authMiddleware);

/**
 * @openapi
 * /transactions/send-tip:
 *   post:
 *     summary: TIPS gönder (kullanıcıya veya wallet address'e)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               recipientId:
 *                 type: string
 *                 description: Alıcı kullanıcı ID (internal transfer için)
 *               walletAddress:
 *                 type: string
 *                 description: Alıcı wallet adresi (external transfer için)
 *               amount:
 *                 type: number
 *                 description: TIPS miktarı
 *               message:
 *                 type: string
 *                 description: Opsiyonel mesaj
 *     responses:
 *       200:
 *         description: Transaction başarıyla oluşturuldu
 *       400:
 *         description: Geçersiz parametre veya yetersiz bakiye
 */
router.post('/send-tip', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const fromUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!fromUserId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { recipientId, walletAddress, amount, message, reason } = req.body;

  // Validation: En az biri olmalı
  if (!recipientId && !walletAddress) {
    return res.status(400).json({ 
      message: 'Either recipientId or walletAddress is required' 
    });
  }

  // İkisi birden olamaz
  if (recipientId && walletAddress) {
    return res.status(400).json({ 
      message: 'Cannot specify both recipientId and walletAddress' 
    });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than 0' });
  }

  // WalletAddress ile gönderim
  if (walletAddress) {
    // Wallet address validation
    if (!walletAddress.startsWith('0x') || walletAddress.length < 20) {
      return res.status(400).json({ 
        message: 'Invalid wallet address format' 
      });
    }

    // Wallet address'den user bulma
    const prisma = getPrisma();
    const recipientWallet = await prisma.wallet.findFirst({
      where: { 
        publicAddress: walletAddress,
        isConnected: true
      },
      include: {
        user: true
      }
    });

    if (!recipientWallet) {
      return res.status(404).json({ 
        message: 'Wallet address not found in system' 
      });
    }

    // Internal transfer olarak işle
    const result = await transactionService.sendTip({
      fromUserId: String(fromUserId),
      toUserId: recipientWallet.userId,
      amount: Number(amount),
      reason: message || reason || undefined
    });

    return res.json({
      id: result.transaction.id,
      actionType: result.transaction.actionType,
      status: result.transaction.status,
      amount: result.transaction.amount,
      toAddress: result.transaction.toAddress,
      toUserId: recipientWallet.userId,
      metadata: result.transaction.metadata,
      provider: result.transaction.provider,
      createdAt: result.transaction.createdAt.toISOString()
    });
  }

  // RecipientId ile gönderim (mevcut mantık)
  if (recipientId) {
    const result = await transactionService.sendTip({
      fromUserId: String(fromUserId),
      toUserId: String(recipientId),
      amount: Number(amount),
      reason: message || reason || undefined
    });

    return res.json({
      id: result.transaction.id,
      actionType: result.transaction.actionType,
      status: result.transaction.status,
      amount: result.transaction.amount,
      toAddress: result.transaction.toAddress,
      toUserId: recipientId,
      metadata: result.transaction.metadata,
      provider: result.transaction.provider,
      createdAt: result.transaction.createdAt.toISOString()
    });
  }

  return res.status(400).json({ message: 'Invalid request' });
}));

/**
 * @openapi
 * /transactions/nft-transfer:
 *   post:
 *     summary: NFT transfer et (kullanıcıdan kullanıcıya)
 *     tags: [Transactions]
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
 *               - recipientId
 *             properties:
 *               nftId:
 *                 type: string
 *                 description: Transfer edilecek NFT ID
 *               recipientId:
 *                 type: string
 *                 description: Alıcı kullanıcı ID
 *               message:
 *                 type: string
 *                 description: Opsiyonel mesaj
 *     responses:
 *       200:
 *         description: NFT başarıyla transfer edildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 nftId:
 *                   type: string
 *                 fromUserId:
 *                   type: string
 *                 toUserId:
 *                   type: string
 *                 nftTransactionId:
 *                   type: string
 *                 transferredAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Geçersiz istek (owner değil, transferable değil, listing aktif, vb.)
 *       401:
 *         description: Yetkisiz erişim
 *       404:
 *         description: NFT veya alıcı kullanıcı bulunamadı
 */
router.post('/nft-transfer', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const fromUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!fromUserId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { nftId, recipientId, message } = req.body;

  if (!nftId || typeof nftId !== 'string') {
    return res.status(400).json({ message: 'nftId is required' });
  }
  if (!recipientId || typeof recipientId !== 'string') {
    return res.status(400).json({ message: 'recipientId is required' });
  }

  const result = await transactionService.transferNFT({
    fromUserId: String(fromUserId),
    toUserId: String(recipientId),
    nftId: String(nftId),
    message: typeof message === 'string' ? message : undefined,
  });

  return res.json({
    success: true,
    nftId: result.nftId,
    fromUserId: result.fromUserId,
    toUserId: result.toUserId,
    nftTransactionId: result.nftTransactionId,
    transferredAt: result.transferredAt.toISOString(),
  });
}));

/**
 * @openapi
 * /transactions/history:
 *   get:
 *     summary: Transaction geçmişi (list)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Transaction geçmişi
 */
router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const cursor = req.query.cursor as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

  // Cache kontrolü - Transaction history asla cache'lenmemeli
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const result = await transactionService.getUserTransactionHistory(
    String(userId),
    { cursor, limit }
  );

  // Enrich with user data
  const prisma = getPrisma();
  const enrichedItems = await Promise.all(
    result.items.map(async (tx) => {
      let fromUser = null;
      let toUser = null;

      if (tx.metadata?.senderUserId) {
        const sender = await prisma.user.findUnique({
          where: { id: tx.metadata.senderUserId as string },
          include: {
            profile: true,
            avatars: { where: { isActive: true }, take: 1 },
            wallets: { take: 1 }
          }
        });
        if (sender) {
          fromUser = {
            id: sender.id,
            name: sender.profile?.displayName || 'Unknown',
            avatar: sender.avatars[0]?.imageUrl || null,
            walletAddress: sender.wallets[0]?.publicAddress || null
          };
        }
      }

      if (tx.metadata?.recipientUserId) {
        const recipient = await prisma.user.findUnique({
          where: { id: tx.metadata.recipientUserId as string },
          include: {
            profile: true,
            avatars: { where: { isActive: true }, take: 1 },
            wallets: { take: 1 }
          }
        });
        if (recipient) {
          toUser = {
            id: recipient.id,
            name: recipient.profile?.displayName || 'Unknown',
            avatar: recipient.avatars[0]?.imageUrl || null,
            walletAddress: recipient.wallets[0]?.publicAddress || null
          };
        }
      }

      return {
        id: tx.id,
        type: tx.isSend() ? 'sent' : 'received',
        actionType: tx.actionType,
        amount: tx.amount,
        currency: 'TIPS',
        from: fromUser,
        to: toUser,
        reason: tx.metadata?.reason || null,
        status: tx.status,
        createdAt: tx.createdAt.toISOString()
      };
    })
  );

  return res.json({
    items: enrichedItems,
    pagination: {
      cursor: result.cursor || null,
      hasMore: result.hasMore,
      limit
    }
  });
}));

/**
 * @openapi
 * /transactions/history/grouped:
 *   get:
 *     summary: "Transaction geçmişi (grouped by date: today, yesterday, etc.)"
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/history/grouped', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Cache kontrolü - Transaction history asla cache'lenmemeli
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const grouped = await transactionService.getUserTransactionHistoryGrouped(String(userId));

  return res.json({
    today: grouped.today.map(tx => tx.toJSON()),
    yesterday: grouped.yesterday.map(tx => tx.toJSON()),
    lastWeek: grouped.lastWeek.map(tx => tx.toJSON()),
    lastMonth: grouped.lastMonth.map(tx => tx.toJSON()),
    older: grouped.older.map(tx => tx.toJSON())
  });
}));

/**
 * @openapi
 * /transactions/{id}:
 *   get:
 *     summary: Transaction durumunu getir
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction bilgisi
 *       404:
 *         description: Transaction bulunamadı
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const transaction = await transactionService.getTransactionById(id);
  
  return res.json({
    id: transaction.id,
    actionType: transaction.actionType,
    status: transaction.status,
    amount: transaction.amount,
    fromAddress: transaction.fromAddress,
    toAddress: transaction.toAddress,
    metadata: transaction.metadata,
    txHash: transaction.txHash,
    provider: transaction.provider,
    errorMessage: transaction.errorMessage,
    createdAt: transaction.createdAt.toISOString(),
    confirmedAt: transaction.confirmedAt?.toISOString() || null,
    failedAt: transaction.failedAt?.toISOString() || null
  });
}));

export default router;

