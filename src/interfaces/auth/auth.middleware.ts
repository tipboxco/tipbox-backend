import { Request, Response, NextFunction } from 'express';
import { verifyAuth0Jwt } from '../../infrastructure/auth/auth0.helper';
import { verifyJwt } from '../../infrastructure/auth/jwt.helper';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  
  // Önce backend JWT'yi dene
  const backendPayload = verifyJwt(token);
  if (backendPayload) {
    // Backend JWT geçerli
    (req as any).user = backendPayload;
    return next();
  }
  
  // Backend JWT geçersizse Auth0 JWT'yi dene
  const auth0Payload = await verifyAuth0Jwt(token);
  if (auth0Payload) {
    // Auth0 JWT geçerli
    (req as any).user = auth0Payload;
    return next();
  }
  
  // Her iki JWT de geçersiz
  return res.status(401).json({ message: 'Invalid token' });
} 