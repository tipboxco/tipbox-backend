import { Request, Response, NextFunction } from 'express';

const SEED_API_TOKEN = process.env.SEED_API_TOKEN;

/**
 * Sabit token ile seed API erişimini doğrular. JWT kullanılmaz.
 * Header: X-Seed-Token = SEED_API_TOKEN (env) ile eşleşmeli.
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
  if (token !== SEED_API_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
