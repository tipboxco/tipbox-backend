import { IdentityProvider } from '../../domain/auth/identity-provider.interface';
import jwt from 'jsonwebtoken';

export class Auth0Adapter implements IdentityProvider {
  getProviderName(): string {
    return 'AUTH0';
  }

  async validateToken(token: string): Promise<{ userId: string } | null> {
    try {
      // Auth0 public key ile doğrulama yapılmalı, burada basit bir örnek
      const decoded = jwt.decode(token) as { sub?: string };
      if (decoded && decoded.sub) {
        return { userId: decoded.sub };
      }
      return null;
    } catch {
      return null;
    }
  }
} 