/**
 * Thirdweb Webhook Router
 * 
 * Thirdweb Engine'den gelen webhook eventlerini dinler ve işler.
 * 
 * Endpoints:
 * - POST /api/webhooks/thirdweb - Ana webhook endpoint
 * - GET /api/webhooks/thirdweb/health - Health check
 * - GET /api/webhooks/thirdweb/logs - Son webhook logları (admin)
 * - GET /api/webhooks/thirdweb/stats - Webhook istatistikleri (admin)
 */

import express, { Request, Response } from 'express';
import { ThirdwebWebhookService } from '../../application/thirdweb-webhook/thirdweb-webhook.service';
import { ThirdwebWebhookPayload, ThirdwebWebhookLogDTO } from './thirdweb-webhook.dto';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import logger from '../../infrastructure/logger/logger';

const router = express.Router();
const webhookService = new ThirdwebWebhookService();

// ============================================================================
// WEBHOOK ENDPOINT (No Auth - Signature Verified)
// ============================================================================

/**
 * @openapi
 * /webhooks/thirdweb:
 *   post:
 *     summary: Thirdweb Engine webhook endpoint
 *     description: |
 *       Thirdweb Engine'den gelen transaction event'lerini işler.
 *       
 *       **Security:**
 *       - X-Engine-Signature header ile HMAC-SHA256 doğrulaması yapılır
 *       - X-Engine-Timestamp ile replay attack önlenir (5 dakika timeout)
 *       
 *       **Supported Events:**
 *       - sent_transaction: Transaction gönderildi
 *       - mined_transaction: Transaction onaylandı
 *       - errored_transaction: Transaction başarısız
 *       - cancelled: Transaction iptal edildi
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - queueId
 *               - status
 *               - chainId
 *               - fromAddress
 *               - toAddress
 *             properties:
 *               queueId:
 *                 type: string
 *                 description: Thirdweb Engine queue ID
 *               status:
 *                 type: string
 *                 enum: [sent, mined, errored, cancelled]
 *               onchainStatus:
 *                 type: string
 *                 enum: [success, reverted]
 *                 nullable: true
 *               chainId:
 *                 type: integer
 *               fromAddress:
 *                 type: string
 *               toAddress:
 *                 type: string
 *               transactionHash:
 *                 type: string
 *                 nullable: true
 *               errorMessage:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Webhook başarıyla işlendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 action:
 *                   type: string
 *                   enum: [created, updated, skipped]
 *                 message:
 *                   type: string
 *                 transactionId:
 *                   type: string
 *                   nullable: true
 *       401:
 *         description: Geçersiz signature veya süresi dolmuş timestamp
 *       400:
 *         description: Geçersiz payload
 *       500:
 *         description: İşleme hatası
 */
router.post('/',
  // Raw body middleware - signature verification için
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.header('X-Engine-Signature');
    const timestamp = req.header('X-Engine-Timestamp');
    
    // Raw body'yi string'e çevir
    const rawBody = Buffer.isBuffer(req.body) 
      ? req.body.toString('utf-8')
      : typeof req.body === 'string' 
        ? req.body 
        : JSON.stringify(req.body);

    // Header validation
    if (!signature || !timestamp) {
      logger.warn({
        ip: req.ip,
        path: req.path,
        message: 'Missing webhook signature or timestamp headers'
      });
      return res.status(401).json({
        success: false,
        error: 'Missing signature or timestamp header'
      });
    }

    // Signature verification
    if (!webhookService.verifySignature(rawBody, timestamp, signature)) {
      logger.warn({
        ip: req.ip,
        path: req.path,
        message: 'Invalid webhook signature'
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid signature'
      });
    }

    // Timestamp expiration check
    if (webhookService.isExpired(timestamp)) {
      logger.warn({
        ip: req.ip,
        timestamp,
        path: req.path,
        message: 'Webhook request has expired'
      });
      return res.status(401).json({
        success: false,
        error: 'Request has expired'
      });
    }

    // Parse payload
    let payload: ThirdwebWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        rawBody: rawBody.substring(0, 200),
        message: 'Failed to parse webhook payload'
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON payload'
      });
    }

    // Validate required fields
    if (!payload.queueId || !payload.status || !payload.chainId || !payload.fromAddress || !payload.toAddress) {
      logger.warn({
        payload: { queueId: payload.queueId, status: payload.status },
        message: 'Missing required fields in webhook payload'
      });
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: queueId, status, chainId, fromAddress, toAddress'
      });
    }

    // Process webhook
    try {
      const result = await webhookService.processWebhook(payload);

      return res.status(200).json({
        success: result.success,
        action: result.action,
        message: result.message,
        transactionId: result.transactionId
      });
    } catch (error) {
      logger.error({
        queueId: payload.queueId,
        error: error instanceof Error ? error.message : String(error),
        message: 'Error processing webhook'
      });

      return res.status(500).json({
        success: false,
        error: 'Internal server error while processing webhook'
      });
    }
  })
);

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * @openapi
 * /webhooks/thirdweb/health:
 *   get:
 *     summary: Webhook service health check
 *     tags: [Webhooks]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'thirdweb-webhook',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// ADMIN ENDPOINTS (Auth Required)
// ============================================================================

/**
 * @openapi
 * /webhooks/thirdweb/logs:
 *   get:
 *     summary: Son webhook loglarını getir
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Webhook logları
 *       401:
 *         description: Unauthorized
 */
router.get('/logs',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    
    const logs = await webhookService.getRecentLogs(limit);
    
    const response: ThirdwebWebhookLogDTO[] = logs.map(log => ({
      id: log.id,
      queueId: log.queueId,
      status: log.status,
      onchainStatus: log.onchainStatus,
      chainId: log.chainId,
      fromAddress: log.fromAddress,
      toAddress: log.toAddress,
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      functionName: log.functionName,
      errorMessage: log.errorMessage,
      transactionId: log.transactionId,
      processedAt: log.processedAt.toISOString(),
      createdAt: log.createdAt.toISOString()
    }));

    return res.json({
      items: response,
      count: response.length
    });
  })
);

/**
 * @openapi
 * /webhooks/thirdweb/stats:
 *   get:
 *     summary: Webhook istatistiklerini getir
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Webhook istatistikleri
 *       401:
 *         description: Unauthorized
 */
router.get('/stats',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await webhookService.getStats();
    return res.json(stats);
  })
);

/**
 * @openapi
 * /webhooks/thirdweb/logs/{queueId}:
 *   get:
 *     summary: Queue ID ile webhook log getir
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: queueId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Webhook log detayı
 *       404:
 *         description: Log bulunamadı
 */
router.get('/logs/:queueId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { queueId } = req.params;
    
    const log = await webhookService.getLogByQueueId(queueId);
    
    if (!log) {
      return res.status(404).json({
        error: 'Webhook log not found'
      });
    }

    const response: ThirdwebWebhookLogDTO = {
      id: log.id,
      queueId: log.queueId,
      status: log.status,
      onchainStatus: log.onchainStatus,
      chainId: log.chainId,
      fromAddress: log.fromAddress,
      toAddress: log.toAddress,
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      functionName: log.functionName,
      errorMessage: log.errorMessage,
      transactionId: log.transactionId,
      processedAt: log.processedAt.toISOString(),
      createdAt: log.createdAt.toISOString()
    };

    return res.json(response);
  })
);

/**
 * @openapi
 * /webhooks/thirdweb/transaction/{transactionId}:
 *   get:
 *     summary: Transaction ID ile webhook logları getir
 *     tags: [Webhooks]
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
 *         description: Transaction'a ait webhook logları
 */
router.get('/transaction/:transactionId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { transactionId } = req.params;
    
    const logs = await webhookService.getLogsByTransactionId(transactionId);
    
    const response: ThirdwebWebhookLogDTO[] = logs.map(log => ({
      id: log.id,
      queueId: log.queueId,
      status: log.status,
      onchainStatus: log.onchainStatus,
      chainId: log.chainId,
      fromAddress: log.fromAddress,
      toAddress: log.toAddress,
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      functionName: log.functionName,
      errorMessage: log.errorMessage,
      transactionId: log.transactionId,
      processedAt: log.processedAt.toISOString(),
      createdAt: log.createdAt.toISOString()
    }));

    return res.json({
      items: response,
      count: response.length
    });
  })
);

export default router;
