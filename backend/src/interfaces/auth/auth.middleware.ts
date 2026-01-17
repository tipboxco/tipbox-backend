import { Request, Response, NextFunction } from 'express';
import { verifyAuth0Jwt } from '../../infrastructure/auth/auth0.helper';
import { verifyJwt } from '../../infrastructure/auth/jwt.helper';
import { isTokenBlacklisted } from '../../infrastructure/auth/token-blacklist';
import logger from '../../infrastructure/logger/logger';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  
  // Token blacklist kontrolü (logout sonrası)
  const isBlacklisted = await isTokenBlacklisted(token);
  if (isBlacklisted) {
    return res.status(401).json({ 
      message: 'Token has been revoked',
      code: 'TOKEN_REVOKED'
    });
  }
  
  // Önce backend JWT'yi dene
  const backendPayload = verifyJwt(token);
  if (backendPayload) {
    // Backend JWT geçerli
    req.user = backendPayload;
    req.token = token; // Token'ı request'e ekle (logout için gerekli)
    return next();
  }
  
  // Backend JWT geçersizse Auth0 JWT'yi dene
  try {
    const auth0Payload = await verifyAuth0Jwt(token);
    if (auth0Payload) {
      // Auth0 JWT geçerli
      req.user = auth0Payload;
      req.token = token; // Token'ı request'e ekle
      logger.debug({
        message: 'Auth0 token ile authentication başarılı',
        sub: auth0Payload.sub,
        path: req.path
      });
      return next();
    }
  } catch (error) {
    logger.warn({
      message: 'Auth0 token doğrulama sırasında hata',
      error: error instanceof Error ? error.message : String(error),
      path: req.path
    });
  }
  
  // Her iki JWT de geçersiz
  logger.debug({
    message: 'Token doğrulama başarısız',
    path: req.path,
    tokenLength: token.length,
    tokenPrefix: token.substring(0, 20) + '...'
  });
  
  return res.status(401).json({ message: 'Invalid token' });
} 