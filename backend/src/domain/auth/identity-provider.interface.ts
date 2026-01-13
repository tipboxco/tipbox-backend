export interface IdentityProvider {
  getProviderName(): string;
  validateToken(token: string): Promise<{ userId: string } | null>;
} 