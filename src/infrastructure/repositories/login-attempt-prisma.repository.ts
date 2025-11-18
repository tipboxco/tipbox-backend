import { PrismaClient } from '@prisma/client';
import { LoginAttempt } from '../../domain/user/login-attempt.entity';
import { LoginAttemptStatus } from '../../domain/user/login-attempt-status.enum';

export class LoginAttemptPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: string): Promise<LoginAttempt | null> {
    const attempt = await this.prisma.loginAttempt.findUnique({ where: { id } });
    return attempt ? this.toDomain(attempt) : null;
  }

  async findByUserId(userId: string | null): Promise<LoginAttempt[]> {
    const attempts = await this.prisma.loginAttempt.findMany({
      where: { userId },
      orderBy: { attemptedAt: 'desc' }
    });
    return attempts.map(attempt => this.toDomain(attempt));
  }

  async findRecentByUserId(userId: string | null, minutes: number = 60): Promise<LoginAttempt[]> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const attempts = await this.prisma.loginAttempt.findMany({
      where: { 
        userId,
        attemptedAt: {
          gte: since
        }
      },
      orderBy: { attemptedAt: 'desc' }
    });
    return attempts.map(attempt => this.toDomain(attempt));
  }

  async findByStatus(status: LoginAttemptStatus): Promise<LoginAttempt[]> {
    const attempts = await this.prisma.loginAttempt.findMany({
      where: { status },
      orderBy: { attemptedAt: 'desc' }
    });
    return attempts.map(attempt => this.toDomain(attempt));
  }

  async findFailedAttemptsByUserId(userId: string | null, since?: Date): Promise<LoginAttempt[]> {
    const attempts = await this.prisma.loginAttempt.findMany({
      where: { 
        userId,
        status: 'FAILED',
        ...(since && { attemptedAt: { gte: since } })
      },
      orderBy: { attemptedAt: 'desc' }
    });
    return attempts.map(attempt => this.toDomain(attempt));
  }

  async create(userId: string | null, status: LoginAttemptStatus, ipAddress: string, userAgent: string): Promise<LoginAttempt> {
    const attempt = await this.prisma.loginAttempt.create({
      data: {
        
        status,
        ipAddress,
        userAgent
      }
    });
    return this.toDomain(attempt);
  }

  async countRecentFailedAttempts(userId: string | null, minutes: number = 15): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return await this.prisma.loginAttempt.count({
      where: {
        userId,
        status: 'FAILED',
        attemptedAt: {
          gte: since
        }
      }
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.loginAttempt.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteOldAttempts(daysBefore: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysBefore * 24 * 60 * 60 * 1000);
    const result = await this.prisma.loginAttempt.deleteMany({
      where: {
        attemptedAt: {
          lt: cutoffDate
        }
      }
    });
    return result.count;
  }

  async list(): Promise<LoginAttempt[]> {
    const attempts = await this.prisma.loginAttempt.findMany();
    return attempts.map(attempt => this.toDomain(attempt));
  }

  private toDomain(prismaAttempt: any): LoginAttempt {
    return new LoginAttempt(
      prismaAttempt.id,
      prismaAttempt.userId,
      prismaAttempt.status as LoginAttemptStatus,
      prismaAttempt.ipAddress,
      prismaAttempt.userAgent,
      prismaAttempt.attemptedAt
    );
  }
}