import { PrismaClient, User as PrismaUser } from '../../generated/prisma';
import { User } from '../../domain/user/user.entity';
import { KycStatus } from '../../domain/user/kyc-status.enum';
import { EmailAlreadyExistsError } from '../errors/custom-errors';

export class UserPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: number): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.toDomain(user) : null;
  }

  async create(email: string, name?: string): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: { email, name }
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
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? this.toDomain(user) : null;
  }

  // Şimdilik passwordHash yok, ileride eklenebilir
  async createWithPassword(email: string, passwordHash: string, name?: string): Promise<User> {
    const user = await this.prisma.user.create({
      data: { email, name /*, passwordHash */ }
    });
    return this.toDomain(user);
  }

  async update(id: number, data: { email?: string; name?: string }): Promise<User | null> {
    const user = await this.prisma.user.update({
      where: { id },
      data,
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
    const users = await this.prisma.user.findMany();
    return users.map(this.toDomain);
  }

  private toDomain(prismaUser: PrismaUser): User {
    return new User(
      prismaUser.id,
      prismaUser.email,
      prismaUser.name,
      prismaUser.auth0Id,
      prismaUser.walletAddress,
      prismaUser.kycStatus as KycStatus,
      prismaUser.createdAt,
      prismaUser.updatedAt
    );
  }
} 