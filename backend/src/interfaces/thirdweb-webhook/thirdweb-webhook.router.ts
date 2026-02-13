/**
 * Thirdweb Webhook Router
 *
 * Thirdweb Engine'den gelen webhook eventlerini dinler ve işler.
 *
 * İki tür webhook:
 * 1) Transaction webhook: Engine üzerinden gönderilen işlemler (sent/mined/errored/cancelled).
 * 2) v1.events (Contract Subscription): Blokzincir event'leri (ERC20 Transfer vb.). EOA cüzdanından
 *    smart wallet adresine yapılan ERC20 transfer'lar SADECE bu event-based webhook ile gelir;
 *    transaction webhook'u sadece Engine'in gönderdiği işlemler için tetiklenir. TIPS token
 *    contract'ı için Thirdweb Dashboard'da Contract Subscription (v1.events, Transfer event)
 *    açık olmalı; handleNormalizedTransferEvent DEPOSIT/WITHDRAW oluşturur.
 *
 * Endpoints:
 * - POST /api/webhooks/thirdweb - Transaction + v1.events (tek URL, topic ile ayrım)
 * - POST /api/webhooks/thirdweb/events - Contract event subscription (alternatif endpoint)
 * - GET /api/webhooks/thirdweb/health - Health check
 * - GET /api/webhooks/thirdweb/logs - Son webhook logları (admin)
 * - GET /api/webhooks/thirdweb/events/logs - Son event logları (admin)
 * - GET /api/webhooks/thirdweb/stats - Webhook istatistikleri (admin)
 */

import express, { Request, Response } from 'express';
import { ThirdwebWebhookService } from '../../application/thirdweb-webhook/thirdweb-webhook.service';
import { ContractEventService } from '../../application/thirdweb-webhook/contract-event.service';
import { ThirdwebWebhookPayload, ThirdwebWebhookLogDTO, normalizeThirdwebWebhookPayload } from './thirdweb-webhook.dto';
import { 
  ThirdwebContractSubscriptionPayload, 
  ContractEventLogDTO,
  ThirdwebWebhookPayloadWrapper,
  isThirdwebV1Payload,
  parseThirdwebPayload
} from './contract-event.dto';
import fs from 'fs';
import path from 'path';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { authMiddleware } from '../auth/auth.middleware';
import logger from '../../infrastructure/logger/logger';

const DEBUG_PAYLOAD_PATH = path.join(process.cwd(), 'logs', 'last-thirdweb-webhook-payload.json');

const router = express.Router();
const webhookService = new ThirdwebWebhookService();
const contractEventService = new ContractEventService();

// ============================================================================
// AUTH PAYLOAD VERIFICATION ENDPOINT
// ============================================================================

/**
 * @openapi
 * /webhooks/thirdweb/auth/verify:
 *   post:
 *     summary: Thirdweb auth-payload doğrulama endpoint'i
 *     description: |
 *       Thirdweb, custom auth-payload yöntemi kullanıldığında bu endpoint'e
 *       istek atarak payload'ı doğrular. 200 döndürülürse authentication onaylanır.
 *       
 *       **Thirdweb Dashboard Yapılandırması:**
 *       1. In-App Wallets > Custom Authentication
 *       2. Auth Method: Custom Payload
 *       3. Verification Endpoint: https://your-api.com/webhooks/thirdweb/auth/verify
 *       
 *       **Payload Format:**
 *       ```json
 *       {
 *         "userId": "tipbox-user-id",
 *         "walletId": "tipbox-embedded-wallet",
 *         "timestamp": 1706456789000
 *       }
 *       ```
 *     tags: [Webhooks, Thirdweb Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - walletId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Tipbox kullanıcı ID'si
 *                 example: "01J9Y4NQSW3KZV9W0F7B6C2D1E"
 *               walletId:
 *                 type: string
 *                 description: Sabit wallet identifier
 *                 example: "tipbox-embedded-wallet"
 *               timestamp:
 *                 type: number
 *                 description: İşlem zamanı (opsiyonel)
 *     responses:
 *       200:
 *         description: Payload doğrulandı - authentication onaylanır
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 userId:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Geçersiz payload formatı
 *       401:
 *         description: Doğrulama başarısız - authentication reddedilir
 */
router.post('/auth/verify',
  express.json({type: 'application/json'}),
  asyncHandler(async (req: Request, res: Response) => {
    let authPayload: { userId?: string; walletId?: string; timestamp?: number };
    
    // Thirdweb payload'ı { payload: "JSON_STRING" } formatında gönderiyor
    // veya direkt { userId, walletId, timestamp } olarak gelebilir
    console.log("req.body", req.body);
    if (req.body.payload && typeof req.body.payload === 'string') {
      // payload JSON string olarak geldi - parse et
      try {
        authPayload = JSON.parse(req.body.payload);
      } catch (parseError) {
        logger.warn({
          message: 'Thirdweb auth verify - payload JSON parse hatası',
          payload: req.body.payload,
          error: parseError instanceof Error ? parseError.message : String(parseError),
          ip: req.ip,
        });
        return res.status(400).json({
          valid: false,
          error: 'Invalid payload JSON format',
        });
      }
    } else if (req.body.userId) {
      // Direkt payload olarak geldi
      authPayload = req.body;
    } else {
      // Bilinmeyen format
      logger.warn({
        message: 'Thirdweb auth verify - tanınmayan payload formatı',
        body: req.body,
        ip: req.ip,
      });
      return res.status(400).json({
        valid: false,
        error: 'Unknown payload format. Expected { payload: "JSON_STRING" } or { userId, walletId }',
      });
    }

    logger.debug({
      message: 'Thirdweb auth verify isteği alındı',
      authPayload: {
        userId: authPayload?.userId,
        walletId: authPayload?.walletId,
        hasTimestamp: !!authPayload?.timestamp,
      },
      ip: req.ip,
      headers: {
        'x-client-id': req.header('x-client-id'),
        'x-secret-key': req.header('x-secret-key') ? '***' : undefined,
      },
    });

    // 1. Payload format kontrolü
    if (!authPayload || typeof authPayload !== 'object') {
      logger.warn({
        message: 'Thirdweb auth verify - geçersiz payload formatı',
        ip: req.ip,
      });
      return res.status(400).json({
        valid: false,
        error: 'Invalid payload format',
      });
    }

    // 2. Gerekli alanları kontrol et
    const { userId, walletId, timestamp } = authPayload;

    if (!userId || typeof userId !== 'string') {
      logger.warn({
        message: 'Thirdweb auth verify - userId eksik veya geçersiz',
        ip: req.ip,
      });
      return res.status(400).json({
        valid: false,
        error: 'userId is required and must be a string',
      });
    }

    if (!walletId || typeof walletId !== 'string') {
      logger.warn({
        message: 'Thirdweb auth verify - walletId eksik veya geçersiz',
        ip: req.ip,
      });
      return res.status(400).json({
        valid: false,
        error: 'walletId is required and must be a string',
      });
    }

    // 3. WalletId kontrolü - sabit değerimizle eşleşmeli
    const expectedWalletId = process.env.THIRDWEB_WALLET_ID || 'tipbox-embedded-wallet';
    if (walletId !== expectedWalletId) {
      logger.warn({
        message: 'Thirdweb auth verify - walletId eşleşmedi',
        expected: expectedWalletId,
        received: walletId,
        ip: req.ip,
      });
      return res.status(401).json({
        valid: false,
        error: 'Invalid walletId',
      });
    }

    // 4. Timestamp kontrolü (opsiyonel - çok eski istekleri reddet)
    if (timestamp) {
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 dakika
      
      if (typeof timestamp === 'number' && (now - timestamp) > maxAge) {
        logger.warn({
          message: 'Thirdweb auth verify - timestamp çok eski',
          timestamp,
          age: now - timestamp,
          maxAge,
          ip: req.ip,
        });
        return res.status(401).json({
          valid: false,
          error: 'Request has expired',
        });
      }
    }

    // 5. UserId format kontrolü (opsiyonel - ULID veya UUID kontrolü yapılabilir)
    // ULID format: 26 karakter, büyük harf + rakam
    const isValidUlid = /^[0-9A-Z]{26}$/.test(userId);
    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    
    if (!isValidUlid && !isValidUuid && userId.length < 10) {
      logger.warn({
        message: 'Thirdweb auth verify - userId formatı şüpheli',
        userId,
        ip: req.ip,
      });
      // Şimdilik sadece uyarı - geçişi bozmamak için reddetmiyoruz
    }

    // 6. Tüm kontroller geçti - 200 döndür
    logger.info({
      message: 'Thirdweb auth verify başarılı',
      userId,
      walletId,
      ip: req.ip,
    });

    return res.status(200).json({
      valid: true,
      userId,
      message: 'Authentication verified successfully',
    });
  })
);

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
  // Raw body middleware - signature verification için (Thirdweb req.body kullanır)
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info({
      message: 'Thirdweb webhook incoming',
      req: req.headers.origin ,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      connection: req.headers['connection'],
      upgrade: req.headers['upgrade'],
      via: req.headers['via'],
      forwarded: req.headers['forwarded'],
      xForwardedFor: req.headers['x-forwarded-for'],
    });
    const signatureFromHeader = req.header('X-Webhook-Signature') || req.header('X-Engine-Signature');
    const timestampFromHeader = req.header('X-Webhook-Timestamp') || req.header('X-Engine-Timestamp');

    const body = Buffer.isBuffer(req.body)
      ? req.body.toString('utf-8')
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);

    if (!signatureFromHeader) {
      return res.status(401).send('Missing signature header');
    }

    // Önce parse et: aynı URL'de hem transaction hem v1.events (Contract Subscription) gelebilir
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch (error) {
      return res.status(400).send('Invalid JSON payload');
    }

    // Her gelen webhook datasını log olarak bas (transaction + v1.events)
    const parsedObj = parsed as Record<string, unknown>;
    const dataArr = parsedObj?.data;
    logger.info({
      message: 'Thirdweb webhook payload received',
      webhookPayload: parsed,
      topic: parsedObj?.topic,
      hasDataArray: Array.isArray(dataArr),
      dataLength: Array.isArray(dataArr) ? dataArr.length : undefined,
    });
    const isV1Events =
      parsed &&
      typeof parsed === 'object' &&
      (parsed as Record<string, unknown>).topic === 'v1.events' &&
      Array.isArray((parsed as Record<string, unknown>).data);

    // --- v1.events (Contract Subscription): topic + data array
    if (isV1Events) {
      const payload = parsed as { timestamp?: number; topic: string; data: unknown[] };
      const timestampToUse = timestampFromHeader || (payload.timestamp != null ? String(payload.timestamp) : '');
      if (!timestampToUse) {
        return res.status(401).send('Missing timestamp (header or payload.timestamp)');
      }
      const MAIN_SECRET = process.env.THIRDWEB_WEBHOOK_SECRET || '';
      const EVENTS_SECRET = process.env.THIRDWEB_EVENTS_WEBHOOK_SECRET || '';
      let valid =
        webhookService.isValidSignature(body, timestampToUse, signatureFromHeader, MAIN_SECRET) ||
        (EVENTS_SECRET ? webhookService.isValidSignature(body, timestampToUse, signatureFromHeader, EVENTS_SECRET) : false) ||
        (timestampFromHeader && timestampFromHeader !== timestampToUse
          ? webhookService.isValidSignature(body, timestampFromHeader, signatureFromHeader, MAIN_SECRET) ||
            (EVENTS_SECRET ? webhookService.isValidSignature(body, timestampFromHeader, signatureFromHeader, EVENTS_SECRET) : false)
          : false);

      // İmza geçersizse: sadece SKIP_SIGNATURE_IN_DEV=true ve production değilken kabul et (test için)
      const skipSignatureInDev = process.env.THIRDWEB_WEBHOOK_SKIP_SIGNATURE_IN_DEV === 'true';
      if (!valid && process.env.NODE_ENV !== 'production' && skipSignatureInDev) {
        logger.warn({
          message: 'v1.events signature invalid, accepting (THIRDWEB_WEBHOOK_SKIP_SIGNATURE_IN_DEV=true)',
          topic: payload.topic
        });
        valid = true;
      }

      if (!valid) {
        logger.warn({
          message: 'v1.events webhook signature invalid',
          topic: payload.topic,
          hasEventsSecret: !!EVENTS_SECRET
        });
        return res.status(401).send('Invalid signature');
      }
      if (webhookService.isExpired(timestampToUse)) {
        return res.status(401).send('Request has expired');
      }

      try {
        if (!fs.existsSync(path.dirname(DEBUG_PAYLOAD_PATH))) {
          fs.mkdirSync(path.dirname(DEBUG_PAYLOAD_PATH), { recursive: true });
        }
        fs.writeFileSync(DEBUG_PAYLOAD_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
      } catch (e) {
        logger.warn({ message: 'Could not write debug payload file', error: String(e) });
      }

      if (!isThirdwebV1Payload(payload)) {
        return res.status(200).json({ success: true, action: 'skipped', message: 'No processable events', eventsProcessed: 0 });
      }
      const normalizedEvents = parseThirdwebPayload(payload);
      if (normalizedEvents.length === 0) {
        return res.status(200).json({
          success: true,
          action: 'skipped',
          message: 'No processable events',
          eventsReceived: payload.data?.length || 0,
          eventsProcessed: 0
        });
      }
      const results = await contractEventService.processNormalizedEvents(normalizedEvents);
      logger.info({
        topic: payload.topic,
        eventsReceived: payload.data.length,
        eventsProcessed: results.processed,
        eventsSkipped: results.skipped,
        message: 'v1.events processed on /api/webhooks/thirdweb'
      });
      return res.status(200).json({
        success: true,
        action: 'processed',
        message: `Processed ${results.processed} events, skipped ${results.skipped}`,
        eventsReceived: payload.data.length,
        eventsProcessed: results.processed,
        eventsSkipped: results.skipped,
        errors: results.errors.length > 0 ? results.errors : undefined
      });
    }

    // --- Transaction webhook (engine.transaction.sent / mined / errored / cancelled)
    if (!timestampFromHeader) {
      return res.status(401).send('Missing timestamp header');
    }
    const WEBHOOK_SECRET = process.env.THIRDWEB_WEBHOOK_SECRET || '';
    if (!webhookService.isValidSignature(body, timestampFromHeader, signatureFromHeader, WEBHOOK_SECRET)) {
      return res.status(401).send('Invalid signature');
    }
    if (webhookService.isExpired(timestampFromHeader)) {
      return res.status(401).send('Request has expired');
    }

    const topLevelKeys = parsed && typeof parsed === 'object' ? Object.keys(parsed as object) : [];
    const dataKeys =
      parsed && typeof parsed === 'object' && (parsed as Record<string, unknown>).data && typeof (parsed as Record<string, unknown>).data === 'object' && !Array.isArray((parsed as Record<string, unknown>).data)
        ? Object.keys((parsed as Record<string, unknown>).data as object)
        : [];
    logger.info({
      message: 'Thirdweb webhook incoming (transaction)',
      webhookPayload: parsed,
      topLevelKeys,
      dataKeys: dataKeys.length ? dataKeys : undefined,
      bodyLength: body.length
    });
    try {
      if (!fs.existsSync(path.dirname(DEBUG_PAYLOAD_PATH))) {
        fs.mkdirSync(path.dirname(DEBUG_PAYLOAD_PATH), { recursive: true });
      }
      fs.writeFileSync(DEBUG_PAYLOAD_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
    } catch (e) {
      logger.warn({ message: 'Could not write debug payload file', error: String(e) });
    }

    let payload: ThirdwebWebhookPayload;
    try {
      payload = normalizeThirdwebWebhookPayload(parsed);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn({ message: 'Thirdweb webhook normalize failed', error: msg, topLevelKeys, dataKeys });
      return res.status(400).send(`Invalid payload: ${msg}`);
    }
    if (!['sent', 'mined', 'errored', 'cancelled'].includes(payload.status)) {
      return res.status(400).send(`Invalid status: ${payload.status}`);
    }
    try {
      await webhookService.processWebhook(payload);
      return res.status(200).send('Webhook received!');
    } catch (error) {
      logger.error({
        queueId: payload.queueId,
        error: error instanceof Error ? error.message : String(error),
        message: 'Error processing webhook'
      });
      return res.status(500).send('Internal server error');
    }
  })
);

// ============================================================================
// CONTRACT EVENT SUBSCRIPTION ENDPOINT
// ============================================================================

/**
 * @openapi
 * /webhooks/thirdweb/events:
 *   post:
 *     summary: Thirdweb Contract Subscription webhook endpoint
 *     description: |
 *       Contract event'lerini (Transfer, Mint, Approval vb.) dinler.
 *       Thirdweb Engine Contract Subscriptions özelliği ile kullanılır.
 *       
 *       **Payload Format (v1.events):**
 *       ```json
 *       {
 *         "timestamp": 1769530718,
 *         "topic": "v1.events",
 *         "data": [{ ... event items ... }]
 *       }
 *       ```
 *       
 *       **Security:**
 *       - X-Webhook-Secret header ile secret doğrulaması (opsiyonel)
 *       - Payload içindeki timestamp ile replay attack önlenir
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Event başarıyla işlendi
 *       401:
 *         description: Geçersiz signature
 *       400:
 *         description: Geçersiz payload
 */
router.post('/events',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req: Request, res: Response) => {
        // Her gelen events webhook datasını log olarak bas
        logger.info({
          message: 'Thirdweb events webhook payload received',
         
        });

    const rawBody = Buffer.isBuffer(req.body) 
      ? req.body.toString('utf-8')
      : typeof req.body === 'string' 
        ? req.body 
        : JSON.stringify(req.body);

    // Parse payload first
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        message: 'Failed to parse event webhook payload'
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON payload'
      });
    }

    // Her gelen events webhook datasını log olarak bas
    logger.info({
      message: 'Thirdweb events webhook payload received',
      webhookPayload: payload,
      topic: payload?.topic,
      dataLength: Array.isArray(payload?.data) ? payload.data.length : undefined,
    });

    // =========================================================================
    // SIGNATURE VERIFICATION
    // =========================================================================
    // Thirdweb farklı header isimleri kullanabilir:
    // - X-Webhook-Signature / X-Engine-Signature
    // - X-Webhook-Timestamp / X-Engine-Timestamp
    // - Payload içinde timestamp
    
    const signature = req.header('X-Webhook-Signature') || req.header('X-Engine-Signature');
    const timestamp = req.header('X-Webhook-Timestamp') || 
                      req.header('X-Engine-Timestamp') || 
                      (payload.timestamp ? String(payload.timestamp) : null);
    
    // Signature kontrolü (eğer THIRDWEB_WEBHOOK_SECRET tanımlıysa)
    const webhookSecret = process.env.THIRDWEB_WEBHOOK_SECRET;
    
    if (webhookSecret && webhookSecret.length > 0) {
      if (signature) {
        // Signature varsa doğrula
        if (!contractEventService.verifySignature(rawBody, timestamp || '', signature)) {
          logger.warn({
            ip: req.ip,
            path: req.path,
            message: 'Invalid event webhook signature'
          });
          return res.status(401).json({
            success: false,
            error: 'Invalid signature'
          });
        }
      } else {
        // Signature yoksa ama secret tanımlı - uyarı logla ama devam et (test amaçlı)
        logger.warn({
          ip: req.ip,
          path: req.path,
          message: 'Webhook received without signature - proceeding in development mode'
        });
        
        // Production'da signature zorunlu olsun
        if (process.env.NODE_ENV === 'production') {
          return res.status(401).json({
            success: false,
            error: 'Missing signature header in production'
          });
        }
      }
    }

    // Timestamp expiration check (varsa)
    if (timestamp && contractEventService.isExpired(timestamp)) {
      logger.warn({
        ip: req.ip,
        timestamp,
        message: 'Event webhook request has expired'
      });
      return res.status(401).json({
        success: false,
        error: 'Request has expired'
      });
    }

    // =========================================================================
    // PROCESS EVENTS
    // =========================================================================
    try {
      // Yeni Thirdweb v1.events formatı mı kontrol et
      if (isThirdwebV1Payload(payload)) {
        // v1.events formatı: birden fazla event içerebilir
        const normalizedEvents = parseThirdwebPayload(payload);
        
        if (normalizedEvents.length === 0) {
          logger.debug({
            topic: payload.topic,
            dataCount: payload.data?.length || 0,
            message: 'No processable events in v1.events payload'
          });
          return res.status(200).json({
            success: true,
            action: 'skipped',
            message: 'No processable events',
            eventsReceived: payload.data?.length || 0,
            eventsProcessed: 0
          });
        }

        // Her event'i işle
        const results = await contractEventService.processNormalizedEvents(normalizedEvents);

        logger.info({
          topic: payload.topic,
          eventsReceived: payload.data.length,
          eventsProcessed: results.processed,
          eventsSkipped: results.skipped,
          message: 'v1.events payload processed'
        });

        return res.status(200).json({
          success: true,
          action: 'processed',
          message: `Processed ${results.processed} events, skipped ${results.skipped}`,
          eventsReceived: payload.data.length,
          eventsProcessed: results.processed,
          eventsSkipped: results.skipped,
          errors: results.errors.length > 0 ? results.errors : undefined
        });
      }
      
      // Legacy format kontrolü
      if (payload.type && payload.data) {
        const result = await contractEventService.processEvent(payload);

        return res.status(200).json({
          success: result.success,
          action: result.action,
          message: result.message,
          eventLogId: result.eventLogId,
          transactionId: result.transactionId
        });
      }

      // Bilinmeyen format
      logger.warn({
        payloadKeys: Object.keys(payload),
        message: 'Unknown webhook payload format'
      });
      
      return res.status(400).json({
        success: false,
        error: 'Unknown payload format. Expected v1.events or legacy event-log format.'
      });

    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        message: 'Error processing contract event'
      });

      return res.status(500).json({
        success: false,
        error: 'Internal server error while processing event'
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

// ============================================================================
// CONTRACT EVENT ADMIN ENDPOINTS
// ============================================================================

/**
 * @openapi
 * /webhooks/thirdweb/events/logs:
 *   get:
 *     summary: Son contract event loglarını getir
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
 *       - in: query
 *         name: eventName
 *         schema:
 *           type: string
 *         description: Belirli bir event tipini filtrele (Transfer, Approval vb.)
 *       - in: query
 *         name: contractAddress
 *         schema:
 *           type: string
 *         description: Contract adresine göre filtrele
 *     responses:
 *       200:
 *         description: Contract event logları
 *       401:
 *         description: Unauthorized
 */
router.get('/events/logs',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    
    const logs = await contractEventService.getRecentEvents(limit);
    
    const response: ContractEventLogDTO[] = logs.map(log => ({
      id: log.id,
      chainId: log.chainId,
      contractAddress: log.contractAddress,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      eventName: log.eventName,
      decodedLog: log.decodedLog,
      timestamp: log.timestamp.toISOString(),
      transactionId: log.transactionId,
      walletId: log.walletId,
      processed: log.processed,
      processedAt: log.processedAt?.toISOString() || null,
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
 * /webhooks/thirdweb/events/stats:
 *   get:
 *     summary: Contract event istatistiklerini getir
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: contractAddress
 *         schema:
 *           type: string
 *         description: Contract adresine göre istatistikler
 *     responses:
 *       200:
 *         description: Event istatistikleri
 */
router.get('/events/stats',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const contractAddress = req.query.contractAddress as string | undefined;
    const stats = await contractEventService.getStats(contractAddress);
    return res.json(stats);
  })
);

/**
 * @openapi
 * /webhooks/thirdweb/events/by-hash/{transactionHash}:
 *   get:
 *     summary: Transaction hash ile event logları getir
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionHash
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction'a ait event logları
 */
router.get('/events/by-hash/:transactionHash',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { transactionHash } = req.params;
    
    const logs = await contractEventService.getEventsByTransactionHash(transactionHash);
    
    const response: ContractEventLogDTO[] = logs.map(log => ({
      id: log.id,
      chainId: log.chainId,
      contractAddress: log.contractAddress,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      eventName: log.eventName,
      decodedLog: log.decodedLog,
      timestamp: log.timestamp.toISOString(),
      transactionId: log.transactionId,
      walletId: log.walletId,
      processed: log.processed,
      processedAt: log.processedAt?.toISOString() || null,
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
 * /webhooks/thirdweb/events/by-wallet/{walletId}:
 *   get:
 *     summary: Wallet ID ile event logları getir
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Wallet'a ait event logları
 */
router.get('/events/by-wallet/:walletId',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { walletId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    
    const logs = await contractEventService.getEventsByWallet(walletId, { limit });
    
    const response: ContractEventLogDTO[] = logs.map(log => ({
      id: log.id,
      chainId: log.chainId,
      contractAddress: log.contractAddress,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      eventName: log.eventName,
      decodedLog: log.decodedLog,
      timestamp: log.timestamp.toISOString(),
      transactionId: log.transactionId,
      walletId: log.walletId,
      processed: log.processed,
      processedAt: log.processedAt?.toISOString() || null,
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
 * /webhooks/thirdweb/events/reprocess:
 *   post:
 *     summary: İşlenmemiş event'leri yeniden işle
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limit:
 *                 type: integer
 *                 default: 100
 *                 maximum: 500
 *     responses:
 *       200:
 *         description: Reprocess sonuçları
 */
router.post('/events/reprocess',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.body.limit) || 100, 500);
    
    const result = await contractEventService.reprocessUnprocessedEvents(limit);
    
    return res.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      errors: result.errors.slice(0, 10) // İlk 10 hatayı göster
    });
  })
);

export default router;
