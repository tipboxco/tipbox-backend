import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

const SEED_API_TOKEN = process.env.SEED_API_TOKEN;

/**
 * Timing-safe token karşılaştırması.
 * Farklı uzunluktaki string'lerde bile sabit zamanlı çalışır.
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) {
    // Uzunluk farkı olsa bile sabit zamanlı karşılaştırma yap
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Sabit token ile seed API erişimini doğrular. JWT kullanılmaz.
 * Header: X-Seed-Token = SEED_API_TOKEN (env) ile eşleşmeli.
 * Timing attack'e karşı constant-time comparison kullanır.
 */
export function seedTokenMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!SEED_API_TOKEN || SEED_API_TOKEN.length === 0) {
    res.status(503).json({ error: 'Seed API token yapılandırılmamış (SEED_API_TOKEN).' });
    return;
  }
  const token = req.headers['x-seed-token'] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!safeCompare(token, SEED_API_TOKEN)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
