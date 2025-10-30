import { PrismaClient } from '@prisma/client';

export interface PasswordResetCodeData {
  id: string;
  userId: string;
  email: string;
  code: string;
  isUsed: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class PasswordResetCodePrismaRepository {
  private prisma = new PrismaClient();

  async create(userId: string, email: string, code: string, expiresAt: Date): Promise<PasswordResetCodeData> {
    // Kullanıcının aktif olmayan kodlarını iptal et
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        isUsed: true,
      },
    });

    // Token olarak code'u kaydet (PasswordResetToken modelini kullanıyoruz)
    const resetCode = await this.prisma.passwordResetToken.create({
      data: {
        userId,
        token: code, // Code'u token olarak saklıyoruz
        expiresAt,
        isUsed: false,
      },
    });

    return {
      id: resetCode.id,
      userId: resetCode.userId,
      email, // Email'i ayrı tutuyoruz
      code: resetCode.token,
      isUsed: resetCode.isUsed,
      expiresAt: resetCode.expiresAt,
      createdAt: resetCode.createdAt,
      updatedAt: resetCode.updatedAt,
    };
  }

  async findByCodeAndEmail(code: string, email: string): Promise<PasswordResetCodeData | null> {
    // Önce email'den user'ı bul
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    // Code'u token olarak sakladığımız için token olarak arayacağız
    const resetCode = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        token: code,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return resetCode ? {
      id: resetCode.id,
      userId: resetCode.userId,
      email,
      code: resetCode.token,
      isUsed: resetCode.isUsed,
      expiresAt: resetCode.expiresAt,
      createdAt: resetCode.createdAt,
      updatedAt: resetCode.updatedAt,
    } : null;
  }

  async findByUserIdAndCode(userId: string, code: string): Promise<PasswordResetCodeData | null> {
    const resetCode = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId,
        token: code,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!resetCode) {
      return null;
    }

    // User'ı bul ve email'i al
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    return {
      id: resetCode.id,
      userId: resetCode.userId,
      email: user?.email || '',
      code: resetCode.token,
      isUsed: resetCode.isUsed,
      expiresAt: resetCode.expiresAt,
      createdAt: resetCode.createdAt,
      updatedAt: resetCode.updatedAt,
    };
  }

  async markAsUsed(id: string): Promise<void> {
    await this.prisma.passwordResetToken.update({
      where: { id },
      data: { isUsed: true },
    });
  }

  async deleteExpiredCodes(): Promise<number> {
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: {
        userId,
      },
    });

    return result.count;
  }
}

