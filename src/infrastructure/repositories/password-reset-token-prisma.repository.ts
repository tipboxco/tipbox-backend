import { PrismaClient } from '@prisma/client';
import { PasswordResetToken } from '../../domain/user/password-reset-token.entity';

export class PasswordResetTokenPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: string): Promise<PasswordResetToken | null> {
    const token = await this.prisma.passwordResetToken.findUnique({ where: { id } });
    return token ? this.toDomain(token) : null;
  }

  async findByToken(token: string): Promise<PasswordResetToken | null> {
    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { token } });
    return resetToken ? this.toDomain(resetToken) : null;
  }

  async findByUserId(userId: string): Promise<PasswordResetToken[]> {
    const tokens = await this.prisma.passwordResetToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return tokens.map(token => this.toDomain(token));
  }

  async findActiveByUserId(userId: string): Promise<PasswordResetToken | null> {
    const token = await this.prisma.passwordResetToken.findFirst({
      where: { 
        userId,
        isUsed: false,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return token ? this.toDomain(token) : null;
  }

  async findValidToken(token: string): Promise<PasswordResetToken | null> {
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: { 
        token,
        isUsed: false,
        expiresAt: {
          gt: new Date()
        }
      }
    });
    return resetToken ? this.toDomain(resetToken) : null;
  }

  async create(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    // Invalidate existing active tokens for the user
    await this.prisma.passwordResetToken.updateMany({
      where: { 
        userId,
        isUsed: false 
      },
      data: { isUsed: true }
    });

    const resetToken = await this.prisma.passwordResetToken.create({
      data: {
        userId,
        token,
        expiresAt
      }
    });
    return this.toDomain(resetToken);
  }

  async markAsUsed(id: string): Promise<PasswordResetToken | null> {
    const token = await this.prisma.passwordResetToken.update({
      where: { id },
      data: { isUsed: true }
    });
    return token ? this.toDomain(token) : null;
  }

  async markTokenAsUsed(token: string): Promise<PasswordResetToken | null> {
    const resetToken = await this.prisma.passwordResetToken.updateMany({
      where: { token },
      data: { isUsed: true }
    });
    
    // Return the updated token
    const updated = await this.findByToken(token);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.passwordResetToken.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteExpiredTokens(): Promise<number> {
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    return result.count;
  }

  async deleteUsedTokens(): Promise<number> {
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: { isUsed: true }
    });
    return result.count;
  }

  async list(): Promise<PasswordResetToken[]> {
    const tokens = await this.prisma.passwordResetToken.findMany();
    return tokens.map(token => this.toDomain(token));
  }

  private toDomain(prismaToken: any): PasswordResetToken {
    return new PasswordResetToken(
      prismaToken.id,
      prismaToken.userId,
      prismaToken.token,
      prismaToken.isUsed,
      prismaToken.expiresAt,
      prismaToken.createdAt,
      prismaToken.updatedAt
    );
  }
}