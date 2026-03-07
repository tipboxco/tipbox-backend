/**
 * Alchemy Notify Webhook Router
 *
 * Endpoint to send notifications to. Alchemy'den gelen webhook isteklerini alır.
 * Desteklenen formatlar:
 * - Graph (block.logs): ERC20 Transfer logları; EOA ↔ smart wallet transferleri DEPOSIT/WITHDRAW olarak işlenir.
 *   Beklenen yapı: block { hash, number, timestamp, logs: [{ data, topics, index, account: { address }, transaction: { hash, from: { address }, to: { address }, ... } }] }
 *   TIPS token contract (config) ve Transfer topic (0xddf252ad...) filtrelenir.
 * - ADDRESS_ACTIVITY / diğer: sadece loglama.
 * CORS: app.ts'de /api/webhooks/alchemy için açık.
 *
 * Test: ngrok + ALCHEMY_WEBHOOK_SIGNING_KEY=whsec_test.
 *
 * @see https://docs.alchemy.com/reference/notify-api-quickstart
 */

import express, { Request, Response } from 'express';
import { AlchemyWebhookService } from '../../application/alchemy-webhook/alchemy-webhook.service';
import type { AlchemyWebhookPayload } from './alchemy-webhook.dto';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import logger from '../../infrastructure/logger/logger';

const router = express.Router();
const alchemyWebhookService = new AlchemyWebhookService();

const ALCHEMY_SIGNATURE_HEADER = 'x-alchemy-signature';

/**
 * POST /api/webhooks/alchemy
 * Alchemy Notify webhook endpoint. Raw body gerekir (signature doğrulama için).
 */
router.post(
  '/',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req: Request, res: Response) => {
    const rawBody =
      Buffer.isBuffer(req.body)
        ? req.body.toString('utf-8')
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body);

    // Her gelen webhook datasını log olarak bas
    let parsed: AlchemyWebhookPayload;
    try {
      parsed = JSON.parse(rawBody) as AlchemyWebhookPayload;
    } catch {
      logger.warn({ message: 'Alchemy webhook invalid JSON', bodyLength: rawBody.length });
      return res.status(400).json({ success: false, error: 'Invalid JSON' });
    }

    logger.debug({
      message: 'Alchemy webhook payload received',
      webhookId: parsed.webhookId,
      type: parsed.type,
      id: parsed.id,
    });

    const signature = req.header(ALCHEMY_SIGNATURE_HEADER);
    const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;

    if (signingKey && signingKey.length > 0) {
      if (!signature) {
        logger.warn({ message: 'Alchemy webhook missing X-Alchemy-Signature header' });
        return res.status(401).json({ success: false, error: 'Missing signature' });
      }
      if (!alchemyWebhookService.verifySignature(rawBody, signature, signingKey)) {
        logger.warn({ message: 'Alchemy webhook invalid signature' });
        return res.status(401).json({ success: false, error: 'Invalid signature' });
      }
    } else {
      logger.debug('Alchemy webhook: ALCHEMY_WEBHOOK_SIGNING_KEY not set, skipping signature verification');
    }

    await alchemyWebhookService.processWebhook(parsed);
    return res.status(200).send('OK');
  })
);

/**
 * GET /api/webhooks/alchemy/health
 * Webhook endpoint erişilebilir mi kontrolü (Alchemy dashboard test için).
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'alchemy-webhook',
    message: 'Alchemy webhook endpoint is available. Use POST / for webhook delivery.',
  });
});

export default router;
