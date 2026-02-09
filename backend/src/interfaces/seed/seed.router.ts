import { Router, Request, Response } from 'express';
import { seedTokenMiddleware } from '../../infrastructure/middleware/seed-token.middleware';
import { listSeeds, runSeed, runSingleSeed, SeedLogChunk, SeedItem } from '../../application/seed/seed.service';
import logger from '../../infrastructure/logger/logger';

const router = Router();

/**
 * @openapi
 * /api/seeds:
 *   get:
 *     summary: Mevcut seed dosyalarının listesini döndürür (id = hash(name))
 *     tags: [Seed]
 *     security:
 *       - xSeedToken: []
 *     responses:
 *       200:
 *         description: Seed listesi
 */
router.get(
  '/',
  seedTokenMiddleware,
  (req: Request, res: Response) => {
    const baseDir = process.cwd();
    const seeds = listSeeds(baseDir);

    return res.json({
      success: true,
      data: {
        seeds,
        count: seeds.length,
      },
    });
  }
);

/**
 * @openapi
 * /api/seeds/run:
 *   post:
 *     summary: Seçilen seed dosyasını veya tümünü çalıştırır (body.seed_id varsa sadece o dosya)
 *     tags: [Seed]
 *     security:
 *       - xSeedToken: []
 *     responses:
 *       200:
 *         description: "Log stream (Content-Type: application/x-ndjson)"
 *       500:
 *         description: Sunucu hatası
 */
router.post(
  '/run',
  seedTokenMiddleware,
  async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const cwd = process.cwd();
    const seeds: SeedItem[] = listSeeds(cwd);
    const body = (req.body || {}) as { seed_id?: string };
    const seedId = typeof body.seed_id === 'string' ? body.seed_id : undefined;

    const send = (chunk: SeedLogChunk | { type: 'seeds'; seeds: SeedItem[] }) => {
      res.write(JSON.stringify(chunk) + '\n');
      (res as NodeJS.WritableStream & { flush?: () => void }).flush?.();
    };

    const toSend = seedId ? seeds.filter((s) => s.id === seedId) : seeds;
    send({ type: 'seeds', seeds: toSend });

    let exitCode: number;
    if (seedId) {
      logger.info({ message: 'Single seed run via API', cwd, seedId });
      const result = await runSingleSeed(cwd, seedId, send as (chunk: SeedLogChunk) => void);
      exitCode = result.exitCode;
    } else {
      logger.info({ message: 'Full seed run via API', cwd });
      const result = await runSeed(cwd, send as (chunk: SeedLogChunk) => void);
      exitCode = result.exitCode;
    }

    send({ type: exitCode === 0 ? 'stdout' : 'stderr', line: `\n[Exit code: ${exitCode}]` });
    res.end();
  }
);

export default router;
