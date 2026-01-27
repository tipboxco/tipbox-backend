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

  async create(userId: string, publicAddress: string, provider: WalletProvider, isConnected = true): Promise<Wallet> {
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
        provider,
        isConnected
      }
    });
    return this.toDomain(wallet);
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
      prismaWallet.provider as WalletProvider,
      prismaWallet.isConnected,
      prismaWallet.balance || 0,
      prismaWallet.lockedBalance || 0,
      prismaWallet.createdAt,
      prismaWallet.updatedAt
    );
  }
}