import { Wallet, WalletProvider } from '../../domain/wallet/wallet.entity';
import { getPrisma } from './prisma.client';

export class WalletPrismaRepository {
  private prisma = getPrisma();

  async findByUserId(userId: string): Promise<Wallet[]> {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return wallets.map(this.toDomain);
  }

  async findById(id: string): Promise<Wallet | null> {
    const wallet = await this.prisma.wallet.findUnique({ where: { id } });
    return wallet ? this.toDomain(wallet) : null;
  }

  async findActiveByUserId(userId: string): Promise<Wallet | null> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { 
        userId, 
        isConnected: true 
      },
      orderBy: { updatedAt: 'desc' }
    });
    return wallet ? this.toDomain(wallet) : null;
  }

  /**
   * Tip alımı için tercih edilen wallet: önce smartAccountAddress olan, yoksa aktif wallet.
   * Alıcı tarafında tip'in Smart Account adresine gitmesi için kullanılır.
   */
  async findPreferredForReceivingByUserId(userId: string): Promise<Wallet | null> {
    const withSmart = await this.prisma.wallet.findFirst({
      where: {
        userId,
        smartAccountAddress: { not: null }
      },
      orderBy: { updatedAt: 'desc' }
    });
    if (withSmart) return this.toDomain(withSmart);
    return this.findActiveByUserId(userId);
  }

  /**
   * Public address (wallet adresi) ile wallet bulur
   * Thirdweb webhook entegrasyonu için kullanılır
   */
  async findByPublicAddress(publicAddress: string): Promise<Wallet | null> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { 
        publicAddress: {
          equals: publicAddress,
          mode: 'insensitive' // Case-insensitive arama (0x adresleri için)
        }
      }
    });
    return wallet ? this.toDomain(wallet) : null;
  }

  /**
   * Public address ile aktif wallet bulur
   */
  async findActiveByPublicAddress(publicAddress: string): Promise<Wallet | null> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { 
        publicAddress: {
          equals: publicAddress,
          mode: 'insensitive'
        },
        isConnected: true 
      }
    });
    return wallet ? this.toDomain(wallet) : null;
  }

  async create(
    userId: string, 
    publicAddress: string, 
    provider: WalletProvider, 
    isConnected = true,
    smartAccountAddress?: string
  ): Promise<Wallet> {
    // Eğer yeni wallet bağlanıyorsa, diğerlerini disconnect et
    if (isConnected) {
      await this.prisma.wallet.updateMany({
        where: { userId, isConnected: true },
        data: { isConnected: false }
      });
    }

    const wallet = await this.prisma.wallet.create({
      data: {
        userId,
        publicAddress,
        smartAccountAddress,
        provider,
        isConnected
      }
    });
    return this.toDomain(wallet);
  }

  /**
   * Smart Account adresini günceller
   */
  async updateSmartAccountAddress(id: string, smartAccountAddress: string): Promise<Wallet | null> {
    const updatedWallet = await this.prisma.wallet.update({
      where: { id },
      data: { smartAccountAddress }
    });
    return this.toDomain(updatedWallet);
  }

  /**
   * Smart Account adresi ile wallet bulur
   */
  async findBySmartAccountAddress(smartAccountAddress: string): Promise<Wallet | null> {
    const wallet = await this.prisma.wallet.findFirst({
      where: { 
        smartAccountAddress: {
          equals: smartAccountAddress,
          mode: 'insensitive'
        }
      }
    });
    return wallet ? this.toDomain(wallet) : null;
  }

  /**
   * Takip (webhook/event) için adres ile wallet bulur.
   * Önce smart_account_address ile eşleştirir, yoksa public_address ile fallback.
   */
  async findByAddressForTracking(address: string): Promise<Wallet | null> {
    const normalized = address?.trim();
    if (!normalized) return null;
    const bySmart = await this.findBySmartAccountAddress(normalized);
    if (bySmart) return bySmart;
    return this.findByPublicAddress(normalized);
  }

  async updateConnectionStatus(id: string, isConnected: boolean): Promise<Wallet | null> {
    // Eğer bu wallet bağlanıyorsa, aynı user'ın diğer wallet'larını disconnect et
    if (isConnected) {
      const wallet = await this.prisma.wallet.findUnique({ where: { id } });
      if (wallet) {
        await this.prisma.wallet.updateMany({
          where: { 
            userId: wallet.userId, 
            isConnected: true,
            id: { not: id }
          },
          data: { isConnected: false }
        });
      }
    }

    const updatedWallet = await this.prisma.wallet.update({
      where: { id },
      data: { isConnected }
    });
    return this.toDomain(updatedWallet);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.wallet.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async updateBalance(id: string, newBalance: number): Promise<Wallet | null> {
    const updatedWallet = await this.prisma.wallet.update({
      where: { id },
      data: { balance: newBalance }
    });
    return this.toDomain(updatedWallet);
  }

  async updateLockedBalance(id: string, newLockedBalance: number): Promise<Wallet | null> {
    const updatedWallet = await this.prisma.wallet.update({
      where: { id },
      data: { lockedBalance: newLockedBalance }
    });
    return this.toDomain(updatedWallet);
  }

  async setBalance(id: string, balance: number, lockedBalance?: number): Promise<Wallet | null> {
    const data: any = { balance };
    if (lockedBalance !== undefined) {
      data.lockedBalance = lockedBalance;
    }

    const updatedWallet = await this.prisma.wallet.update({
      where: { id },
      data
    });
    return this.toDomain(updatedWallet);
  }

  private toDomain(prismaWallet: any): Wallet {
    return new Wallet(
      prismaWallet.id,
      prismaWallet.userId,
      prismaWallet.publicAddress,
      prismaWallet.smartAccountAddress || null,
      prismaWallet.provider as WalletProvider,
      prismaWallet.isConnected,
      prismaWallet.balance || 0,
      prismaWallet.lockedBalance || 0,
      prismaWallet.createdAt,
      prismaWallet.updatedAt
    );
  }
}