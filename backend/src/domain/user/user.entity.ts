import { Wallet } from '../wallet/wallet.entity';

// User Entity
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export class User {
  constructor(
    public readonly id: string,
    public readonly email: string | null,
    public readonly passwordHash: string | null,
    public readonly status: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    // Profile bilgisi (opsiyonel, join ile gelir)
    public readonly displayName?: string | null,
    // Auth0 integration - schema'da olmadığı için şimdilik null (gelecekte ayrı tablo)
    public readonly auth0Id?: string | null,
    // KYC status - ayrı tablo olacak, şimdilik null
    public readonly kycStatus?: string | null,
    // Email verification status
    public readonly emailVerified?: boolean | null,
    // Wallet'lar - ayrı Wallet entity'leri array'i (relation)
    public readonly wallets?: Wallet[]
  ) {}

  // Backward compatibility için getter'lar
  get name(): string | null {
    return this.displayName || null;
  }

  // Primary wallet address (en aktif olan)
  get walletAddress(): string | null {
    const activeWallet = this.wallets?.find(w => w.isConnected);
    return activeWallet?.publicAddress || null;
  }

  // Tüm wallet'ları alır
  get allWallets(): Wallet[] {
    return this.wallets || [];
  }
} 