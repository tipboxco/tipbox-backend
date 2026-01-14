import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { SyncReceiverService } from '../../application/sync-receiver/sync-receiver.service';
import logger from '../../infrastructure/logger/logger';
import {
  SyncPayload,
  SyncHeaders,
  SyncResponse,
  SyncErrorResponse,
  SyncStatusResponse,
  SyncModuleType,
} from './sync-receiver.dto';

const router = Router();
const syncReceiverService = new SyncReceiverService();

/**
 * @openapi
 * /api/sync-receiver:
 *   post:
 *     summary: Sync batch verilerini al ve işle
 *     description: |
 *       Harici sistemlerden gelen bulk sync verilerini alır ve veritabanına yazar.
 *       Brand, Category veya Product tipinde batch veriler gönderilebilir.
 *       Her batch işlendikten sonra sonuç döner.
 *     tags: [Sync Receiver]
 *     parameters:
 *       - in: header
 *         name: X-Sync-Secret
 *         required: true
 *         schema:
 *           type: string
 *         description: Sync işlemi için secret token
 *       - in: header
 *         name: X-Sync-Id
 *         required: false
 *         schema:
 *           type: string
 *         description: Sync configuration ID
 *       - in: header
 *         name: X-Sync-Job-Id
 *         required: false
 *         schema:
 *           type: string
 *         description: Sync job ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sync_id
 *               - job_id
 *               - module_type
 *               - batch_number
 *               - total_batches
 *               - batch_size
 *               - total_records
 *               - data
 *               - timestamp
 *             properties:
 *               sync_id:
 *                 type: string
 *                 description: Sync configuration ID
 *                 example: "sync_01ABC123"
 *               job_id:
 *                 type: string
 *                 description: Sync job ID
 *                 example: "job_01XYZ789"
 *               module_type:
 *                 type: string
 *                 enum: [product, category, brand, brand-categories]
 *                 description: Veri tipi
 *                 example: "product"
 *               batch_number:
 *                 type: integer
 *                 description: Mevcut batch numarası
 *                 example: 1
 *               total_batches:
 *                 type: integer
 *                 description: Toplam batch sayısı
 *                 example: 10
 *               batch_size:
 *                 type: integer
 *                 description: Batch başına kayıt sayısı
 *                 example: 100
 *               total_records:
 *                 type: integer
 *                 description: Toplam kayıt sayısı
 *                 example: 1000
 *               data:
 *                 type: array
 *                 description: Kayıt listesi
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Kayıt ID
 *                     name:
 *                       type: string
 *                       description: Kayıt adı
 *                     description:
 *                       type: string
 *                       description: Açıklama
 *                     image_url:
 *                       type: string
 *                       description: Görsel URL
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: Gönderim zamanı
 *                 example: "2026-01-10T12:00:00.000Z"
 *     responses:
 *       200:
 *         description: Batch başarıyla işlendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Batch 1/10 processed successfully"
 *                 received_at:
 *                   type: string
 *                   format: date-time
 *                 processing_time_ms:
 *                   type: integer
 *                   example: 150
 *                 processed:
 *                   type: integer
 *                   example: 100
 *                 failed:
 *                   type: integer
 *                   example: 0
 *                 created:
 *                   type: integer
 *                   example: 80
 *                 updated:
 *                   type: integer
 *                   example: 20
 *                 batch_summary:
 *                   type: object
 *                   properties:
 *                     sync_id:
 *                       type: string
 *                     job_id:
 *                       type: string
 *                     module_type:
 *                       type: string
 *                     batch_number:
 *                       type: integer
 *                     total_batches:
 *                       type: integer
 *                     records_in_batch:
 *                       type: integer
 *                     total_records:
 *                       type: integer
 *       400:
 *         description: Geçersiz payload
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
 *                   example: "Invalid payload: 'data' must be an array"
 *       401:
 *         description: Geçersiz veya eksik secret token
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
 *                   example: "Invalid or missing secret token"
 *       500:
 *         description: Sunucu hatası
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      // Headers'ı al
      const headers: SyncHeaders = {
        contentType: req.headers['content-type'] as string,
        syncSecret: req.headers['x-sync-secret'],
        syncId: req.headers['x-sync-id'],
        syncJobId: req.headers['x-sync-job-id'],
      };

      // Secret token doğrulama

      // Payload validasyonu
      const validation = syncReceiverService.validatePayload(req.body);
      if (!validation.valid) {
        logger.warn('[SyncReceiver] ❌ Invalid payload', { error: validation.error });
        const errorResponse: SyncErrorResponse = {
          success: false,
          error: validation.error || 'Invalid payload',
          processed: 0,
          failed: 0,
          received_at: new Date().toISOString(),
        };
        return res.status(400).json(errorResponse);
      }

      const body = req.body as SyncPayload;

      // Batch'i işle
      const result = await syncReceiverService.processSyncBatch(body);

      const processingTime = Date.now() - startTime;

      // Log
      logger.info('[SyncReceiver] ✅ Batch received and processed', {
        moduleType: body.module_type,
        batch: `${body.batch_number}/${body.total_batches}`,
        records: body.data.length,
        processed: result.processed,
        failed: result.failed,
        created: result.created,
        updated: result.updated,
        processingTime: `${processingTime}ms`,
      });

      // Başarılı response
      const response: SyncResponse = {
        success: true,
        message: `Batch ${body.batch_number}/${body.total_batches} processed successfully`,
        received_at: new Date().toISOString(),
        processing_time_ms: processingTime,
        processed: result.processed,
        failed: result.failed,
        created: result.created,
        updated: result.updated,
        batch_summary: {
          sync_id: body.sync_id,
          job_id: body.job_id,
          module_type: body.module_type,
          batch_number: body.batch_number,
          total_batches: body.total_batches,
          records_in_batch: body.data.length,
          total_records: body.total_records,
        },
        processed_records: result.records,
      };
    
      return res.status(200).json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[SyncReceiver] ❌ Error processing batch', { error: message });

      const errorResponse: SyncErrorResponse = {
        success: false,
        error: message,
        processed: 0,
        failed: 0,
        received_at: new Date().toISOString(),
      };

      return res.status(500).json(errorResponse);
    }
  }),
);

/**
 * @openapi
 * /sync-receiver:
 *   get:
 *     summary: Sync receiver endpoint durumunu kontrol et
 *     description: Endpoint'in hazır olup olmadığını ve beklenen payload formatını döner.
 *     tags: [Sync Receiver]
 *     responses:
 *       200:
 *         description: Endpoint durumu ve beklenen format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ready"
 *                 endpoint:
 *                   type: string
 *                   example: "/sync-receiver"
 *                 description:
 *                   type: string
 *                   example: "Sync batch receiver endpoint"
 *                 expected_payload:
 *                   type: object
 *                 expected_headers:
 *                   type: object
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const response: SyncStatusResponse = {
      status: 'ready',
      endpoint: '/sync-receiver',
      description: 'Sync batch receiver endpoint - Brand, Category, Product, Brand Categories verilerini alır ve veritabanına yazar',
      expected_payload: {
        sync_id: 'string - Sync configuration ID',
        job_id: 'string - Sync job ID',
        module_type: 'product | category | brand | brand-categories',
        batch_number: 'number - Current batch number',
        total_batches: 'number - Total number of batches',
        batch_size: 'number - Records per batch',
        total_records: 'number - Total records across all batches',
        data: 'array of records',
        timestamp: 'ISO date string',
      },
      expected_headers: {
        'Content-Type': 'application/json',
        'X-Sync-Secret': 'required - Secret token for authentication',
        'X-Sync-Id': 'optional - Sync config ID',
        'X-Sync-Job-Id': 'optional - Job ID',
      },
    };

    return res.status(200).json(response);
  }),
);

/**
 * @openapi
 * /sync-receiver/stats/{moduleType}:
 *   get:
 *     summary: Modül tipine göre kayıt sayısını getir
 *     description: Veritabanındaki brand, category veya product sayısını döner.
 *     tags: [Sync Receiver]
 *     parameters:
 *       - in: path
 *         name: moduleType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [product, category, brand, brand-categories]
 *         description: Modül tipi
 *       - in: header
 *         name: X-Sync-Secret
 *         required: true
 *         schema:
 *           type: string
 *         description: Sync işlemi için secret token
 *     responses:
 *       200:
 *         description: Kayıt sayısı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 module_type:
 *                   type: string
 *                 count:
 *                   type: integer
 *       401:
 *         description: Geçersiz veya eksik secret token
 *       400:
 *         description: Geçersiz modül tipi
 */
router.get(
  '/stats/:moduleType',
  asyncHandler(async (req: Request, res: Response) => {
    const syncSecret = req.headers['x-sync-secret'];

    // Secret token doğrulama
    if (!syncReceiverService.validateSyncSecret(syncSecret)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or missing secret token',
      });
    }

    const { moduleType } = req.params;

    if (!['product', 'category', 'brand', 'brand-categories'].includes(moduleType)) {
      return res.status(400).json({
        success: false,
        error: "Invalid module type. Must be 'product', 'category', 'brand', or 'brand-categories'",
      });
    }

    const stats = await syncReceiverService.getModuleStats(moduleType as SyncModuleType);

    return res.status(200).json({
      success: true,
      module_type: moduleType,
      count: stats.count,
      timestamp: new Date().toISOString(),
    });
  }),
);

/**
 * CORS preflight için OPTIONS handler
 */
router.options('/', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sync-Secret, X-Sync-Id, X-Sync-Job-Id');
  res.status(204).end();
});

export default router;

