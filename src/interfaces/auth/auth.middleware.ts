import { Request, Response, NextFunction } from 'express';
import { verifyAuth0Jwt } from '../../infrastructure/auth/auth0.helper';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  const payload = await verifyAuth0Jwt(token);
  if (!payload) {
    return res.status(401).json({ message: 'Invalid token' });
  }
  // User context'i request'e ekle
  (req as any).user = payload;
  next();
} 