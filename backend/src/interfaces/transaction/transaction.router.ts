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
 * /api/transactions/send-tip:
 *   post:
 *     summary: TIPS gönder (alıcı kullanıcıya)
 *     description: |
 *       Gönderen kullanıcının aktif wallet'ından, alıcı kullanıcının wallet tablosundaki
 *       smartAccountAddress adresine tip gönderir. smartAccountAddress yoksa public_address kullanılır.
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
 *               - recipientId
 *               - amount
 *             properties:
 *               recipientId:
 *                 type: string
 *                 description: Alıcı kullanıcının user id değeri (tip bu kullanıcının wallet'ına gider)
 *               amount:
 *                 type: number
 *                 description: TIPS miktarı
 *               message:
 *                 type: string
 *                 description: Opsiyonel mesaj (metadata'da reason olarak saklanır)
 *     responses:
 *       200:
 *         description: Transaction başarıyla oluşturuldu (kuyruğa alındı; kullanıcı transaction history ile takip eder)
 *       400:
 *         description: Geçersiz parametre veya işlem reddedildi (örn. yetersiz bakiye). Body'de success=false, error.message kullanıcıya gösterilmeli.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 error:
 *                   type: object
 *                   properties:
 *                     code: { type: string }
 *                     message: { type: string, description: 'Kullanıcıya gösterilecek hata mesajı (örn. Insufficient balance. Available: X TIPS)' }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Alıcı veya gönderen wallet bulunamadı (error.message kullanıcıya gösterilmeli)
 */
router.post('/send-tip', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const fromUserId = userPayload?.id || userPayload?.userId || userPayload?.sub;

  if (!fromUserId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { recipientId, amount, message } = req.body;

  if (!recipientId) {
    return res.status(400).json({ success: false, message: 'recipientId is required' });
  }

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
  }

  // recipientId = alıcı kullanıcı id; servis wallet tablosundan alıcının wallet'ını bulur,
  // smartAccountAddress (yoksa public_address) adresine tip gönderimi yapar
  const result = await transactionService.sendTip({
    fromUserId: String(fromUserId),
    toUserId: String(recipientId),
    amount: Number(amount),
    reason: message || undefined
  });

  const tipData = {
    id: result.transaction.id,
    actionType: result.transaction.actionType,
    status: result.transaction.status,
    amount: result.transaction.amount,
    toAddress: result.transaction.toAddress,
    toUserId: recipientId,
    txHash: result.transaction.txHash ?? undefined,
    metadata: result.transaction.metadata,
    provider: result.transaction.provider,
    createdAt: result.transaction.createdAt.toISOString(),
  };
  return res.json({ success: true, data: tipData, ...tipData });
}));

/**
 * @openapi
 * /api/transactions/{transactionId}/cancel:
 *   post:
 *     summary: Tip send işlemini iptal et
 *     description: |
 *       Sadece status=created (henüz on-chain gönderilmemiş) ve TIP_SEND olan işlem iptal edilebilir.
 *       Kuyrukta en az 15 sn gecikme olduğu için kullanıcı bu süre içinde iptal edebilir.
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: İşlem iptal edildi
 *       400:
 *         description: İptal edilemez (örn. zaten gönderilmiş veya başka kullanıcıya ait)
 *       404:
 *         description: Transaction bulunamadı
 */
router.post('/:transactionId/cancel', asyncHandler(async (req: Request, res: Response) => {
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  const { transactionId } = req.params;
  if (!transactionId) {
    return res.status(400).json({ success: false, message: 'transactionId is required' });
  }
  const transaction = await transactionService.cancelTipSend(transactionId, String(userId));
  const cancelData = {
    id: transaction.id,
    status: transaction.status,
    errorMessage: transaction.errorMessage ?? undefined,
    message: 'Transaction cancelled',
  };
  return res.json({ success: true, data: cancelData, ...cancelData });
}));

/**
 * @openapi
 * /api/transactions/nft-transfer:
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
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { nftId, recipientId, message } = req.body;

  if (!nftId || typeof nftId !== 'string') {
    return res.status(400).json({ success: false, message: 'nftId is required' });
  }
  if (!recipientId || typeof recipientId !== 'string') {
    return res.status(400).json({ success: false, message: 'recipientId is required' });
  }

  const result = await transactionService.transferNFT({
    fromUserId: String(fromUserId),
    toUserId: String(recipientId),
    nftId: String(nftId),
    message: typeof message === 'string' ? message : undefined,
  });

  const nftData = {
    nftId: result.nftId,
    fromUserId: result.fromUserId,
    toUserId: result.toUserId,
    nftTransactionId: result.nftTransactionId,
    transferredAt: result.transferredAt.toISOString(),
  };
  return res.json({ success: true, data: nftData, ...nftData });
}));

/**
 * @openapi
 * /api/transactions/history:
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
    return res.status(401).json({ success: false, message: 'Unauthorized' });
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

  // Enrich with user data — batch lookup (N+1 query fix)
  const prisma = getPrisma();
  const allUserIds = new Set<string>();
  for (const tx of result.items) {
    if (tx.metadata?.senderUserId && typeof tx.metadata.senderUserId === 'string') {
      allUserIds.add(tx.metadata.senderUserId);
    }
    if (tx.metadata?.recipientUserId && typeof tx.metadata.recipientUserId === 'string' && !tx.metadata.recipientUserId.startsWith('0x')) {
      allUserIds.add(tx.metadata.recipientUserId);
    }
  }

  const userMap = new Map<string, { id: string; name: string; avatar: string | null; walletAddress: string | null }>();
  if (allUserIds.size > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: [...allUserIds] } },
      include: {
        profile: true,
        avatars: { where: { isActive: true }, take: 1 },
        wallets: { take: 1 },
      },
    });
    for (const u of users) {
      userMap.set(u.id, {
        id: u.id,
        name: u.profile?.displayName || 'Unknown',
        avatar: u.avatars[0]?.imageUrl || null,
        walletAddress: u.wallets[0]?.publicAddress || null,
      });
    }
  }

  const enrichedItems = result.items.map((tx) => {
    const fromUser = tx.metadata?.senderUserId
      ? userMap.get(tx.metadata.senderUserId as string) || null
      : null;
    const toUser = (tx.metadata?.recipientUserId && typeof tx.metadata.recipientUserId === 'string' && !tx.metadata.recipientUserId.startsWith('0x'))
      ? userMap.get(tx.metadata.recipientUserId) || null
      : null;

    const meta = tx.metadata as Record<string, unknown> | undefined;

    return {
      id: tx.id,
      type: tx.isSend() ? 'sent' : 'received',
      actionType: tx.actionType,
      amount: tx.amount,
      currency: 'TIPS',
      from: fromUser,
      to: toUser,
      reason: meta?.reason || null,
      // Commission / fee data
      feeAmount: meta?.feeAmount ?? null,
      feePercentage: meta?.feePercentage ?? null,
      grossAmount: meta?.grossAmount ?? null,
      status: tx.status,
      txHash: tx.txHash || null,
      createdAt: tx.createdAt.toISOString(),
      confirmedAt: tx.confirmedAt?.toISOString() || null,
    };
  });

  const historyData = {
    items: enrichedItems,
    pagination: {
      cursor: result.cursor || null,
      hasMore: result.hasMore,
      limit,
    },
  };
  return res.json({ success: true, data: historyData, ...historyData });
}));

/**
 * @openapi
 * /api/transactions/history/grouped:
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
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Cache kontrolü - Transaction history asla cache'lenmemeli
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const grouped = await transactionService.getUserTransactionHistoryGrouped(String(userId));

  const groupedData = {
    today: grouped.today.map(tx => tx.toJSON()),
    yesterday: grouped.yesterday.map(tx => tx.toJSON()),
    lastWeek: grouped.lastWeek.map(tx => tx.toJSON()),
    lastMonth: grouped.lastMonth.map(tx => tx.toJSON()),
    older: grouped.older.map(tx => tx.toJSON()),
  };
  return res.json({ success: true, data: groupedData, ...groupedData });
}));

/**
 * @openapi
 * /api/transactions/{id}:
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
  const userPayload = req.user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { id } = req.params;
  const transaction = await transactionService.getTransactionById(id);

  // Authorization: kullanıcı sadece kendi transaction'larını görebilir
  const prisma = getPrisma();
  const wallet = await prisma.wallet.findUnique({
    where: { id: transaction.walletId },
    select: { userId: true },
  });
  if (!wallet || wallet.userId !== String(userId)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const txData = {
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
    failedAt: transaction.failedAt?.toISOString() || null,
  };
  return res.json({ success: true, data: txData, ...txData });
}));

export default router;

