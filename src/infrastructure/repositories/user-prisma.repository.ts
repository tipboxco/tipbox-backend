import { PrismaClient } from '@prisma/client';
import { User } from '../../domain/user/user.entity';
import { Wallet, WalletProvider } from '../../domain/wallet/wallet.entity';
import { EmailAlreadyExistsError } from '../errors/custom-errors';

export class UserPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ 
      where: { id },
      include: { 
        profile: true,
        wallets: true
      }
    });
    return user ? this.toDomain(user) : null;
  }

  async create(email: string, displayName?: string): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: { 
          email,
          profile: displayName ? {
            create: { displayName }
          } : undefined
        },
        include: { 
          profile: true,
          wallets: true
        }
      });
      return this.toDomain(user);
    } catch (err: any) {
      if (err.code === 'P2002' && err.meta?.target?.includes('email')) {
        throw new EmailAlreadyExistsError();
      }
      throw err;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ 
      where: { email },
      include: { 
        profile: true,
        wallets: true
      }
    });
    return user ? this.toDomain(user) : null;
  }

  async createWithPassword(email: string, passwordHash: string, displayName?: string): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: { 
          email, 
          passwordHash,
          profile: displayName ? {
            create: { displayName }
          } : undefined
        },
        include: { 
          profile: true,
          wallets: true
        }
      });
      return this.toDomain(user);
    } catch (err: any) {
      if (err.code === 'P2002' && err.meta?.target?.includes('email')) {
        throw new EmailAlreadyExistsError();
      }
      throw err;
    }
  }

  async update(id: number, data: { email?: string; passwordHash?: string; status?: string }): Promise<User | null> {
    const user = await this.prisma.user.update({
      where: { id },
      data,
      include: { 
        profile: true,
        wallets: true
      }
    });
    return user ? this.toDomain(user) : null;
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.user.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      include: { 
        profile: true,
        wallets: true
      }
    });
    return users.map(user => this.toDomain(user));
  }

  private toDomain(prismaUser: any): User {
    // Wallet'ları domain entity'ye çevir
    const wallets = prismaUser.wallets?.map((w: any) => new Wallet(
      w.id,
      w.userId,
      w.publicAddress,
      w.provider as WalletProvider,
      w.isConnected,
      w.createdAt,
      w.updatedAt
    )) || [];

    return new User(
      prismaUser.id,
      prismaUser.email,
      prismaUser.passwordHash,
      prismaUser.status,
      prismaUser.createdAt,
      prismaUser.updatedAt,
      // Profile'dan displayName'i al
      prismaUser.profile?.displayName || null,
      // Auth0 - şimdilik null (schema'da yok)
      null,
      // KYC - şimdilik null (ayrı tablo)
      null,
      // Wallet'lar - relation'dan gelen data
      wallets
    );
  }
} 