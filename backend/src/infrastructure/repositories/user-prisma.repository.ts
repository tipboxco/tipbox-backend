import type { User as PrismaUserModel, Wallet as PrismaWalletModel, Profile as PrismaProfileModel } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { User } from '../../domain/user/user.entity';
import { Wallet, WalletProvider } from '../../domain/wallet/wallet.entity';
import { EmailAlreadyExistsError } from '../errors/custom-errors';
import { DEFAULT_PROFILE_BANNER_URL } from '../../domain/user/profile.constants';
import { getPrisma } from './prisma.client';

type PrismaUserWithRelations = PrismaUserModel & {
  profile: PrismaProfileModel | null;
  wallets: PrismaWalletModel[];
};

export class UserPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<User | null> {
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
          profile: displayName
            ? {
                create: {
                  displayName,
                  bannerUrl: DEFAULT_PROFILE_BANNER_URL,
                },
              }
            : undefined,
        },
        include: { 
          profile: true,
          wallets: true
        }
      });
      return this.toDomain(user);
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && (err.meta?.target as string[] | undefined)?.includes('email')) {
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

  async findByAuth0Id(auth0Id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ 
      where: { auth0Id },
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
          profile: displayName
            ? {
                create: {
                  displayName,
                  bannerUrl: DEFAULT_PROFILE_BANNER_URL,
                },
              }
            : undefined,
        },
        include: { 
          profile: true,
          wallets: true
        }
      });
      return this.toDomain(user);
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && (err.meta?.target as string[] | undefined)?.includes('email')) {
        throw new EmailAlreadyExistsError();
      }
      throw err;
    }
  }

  async createWithAuth0(
    auth0Id: string,
    email: string,
    displayName?: string,
    emailVerified: boolean = true
  ): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: { 
          auth0Id,
          email, 
          emailVerified,
          status: emailVerified ? 'ACTIVE' : 'PENDING_VERIFICATION',
          profile: displayName
            ? {
                create: {
                  displayName,
                  bannerUrl: DEFAULT_PROFILE_BANNER_URL,
                },
              }
            : undefined,
        },
        include: { 
          profile: true,
          wallets: true
        }
      });
      return this.toDomain(user);
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = err.meta?.target as string[] | undefined;
        if (target?.includes('email')) {
          throw new EmailAlreadyExistsError();
        }
        // Auth0Id zaten varsa, mevcut kullanıcıyı döndür
        if (target?.includes('auth0_id')) {
          const existingUser = await this.findByAuth0Id(auth0Id);
          if (existingUser) {
            return existingUser;
          }
        }
      }
      throw err;
    }
  }

  async update(id: string, data: { email?: string; passwordHash?: string; status?: string }): Promise<User | null> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data,
        include: { 
          profile: true,
          wallets: true
        }
      });
      return user ? this.toDomain(user) : null;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // Prisma P2025: Record not found
        if (err.code === 'P2025') {
          return null;
        }
        // Email duplicate hatası
        if (err.code === 'P2002' && (err.meta?.target as string[] | undefined)?.includes('email')) {
          throw new EmailAlreadyExistsError();
        }
      }
      throw err;
    }
  }

  async delete(id: string): Promise<boolean> {
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

  private toDomain(prismaUser: PrismaUserWithRelations): User {
    // Wallet'ları domain entity'ye çevir
    const wallets = prismaUser.wallets?.map((w: PrismaWalletModel) => new Wallet(
      w.id,
      w.userId,
      w.smartAccountAddress,
      w.smartAccountAddress,
      w.provider as WalletProvider,
      w.isConnected,
      w.balance || 0,
      w.lockedBalance || 0,
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
      // Auth0 ID
      prismaUser.auth0Id || null,
      // KYC - şimdilik null (ayrı tablo)
      null,
      // Email verified status
      prismaUser.emailVerified ?? false,
      // Wallet'lar - relation'dan gelen data
      wallets
    );
  }
} 