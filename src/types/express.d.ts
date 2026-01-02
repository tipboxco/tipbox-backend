import { JwtPayload } from 'jsonwebtoken';

/**
 * Express Request type extension
 * Auth middleware tarafından eklenen user ve token property'lerini tanımlar
 * 
 * Backend JWT payload: { id: string, email: string, ... }
 * Auth0 JWT payload: { sub: string, email: string, ... }
 */
declare global {
  namespace Express {
    interface Request {
      /**
       * JWT payload - Backend JWT veya Auth0 JWT'den gelir
       * id, userId veya sub field'larından biri mutlaka olmalı
       */
      user?: (JwtPayload & {
        id?: string;
        userId?: string;
        sub?: string;
        email?: string;
        [key: string]: unknown;
      }) | null;
      
      /**
       * JWT token string - Logout için gerekli
       */
      token?: string;
    }
  }
}

export {};

