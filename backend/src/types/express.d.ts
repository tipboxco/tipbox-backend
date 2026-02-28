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

      /**
       * Request trace ID - request-logger middleware tarafından eklenir
       */
      traceId?: string;

      /**
       * Auth0 OIDC middleware (express-openid-connect)
       */
      oidc?: {
        isAuthenticated: () => boolean;
        user?: {
          sub: string;
          email?: string;
          name?: string;
          nickname?: string;
          picture?: string;
          email_verified?: boolean;
          [key: string]: unknown;
        };
        idToken?: string;
        accessToken?: string;
        refreshToken?: string;
        idTokenClaims?: {
          exp?: number;
          [key: string]: unknown;
        };
      };
    }

    interface Response {
      /**
       * Auth0 OIDC middleware methods
       */
      oidc?: {
        login: (options?: { returnTo?: string }) => void;
        logout: (options?: { returnTo?: string }) => void;
      };
    }
  }
}

export {};

