import { PrismaClient } from '@prisma/client';

export interface EmailVerificationCodeData {
  id: string;
  userId: string;
  email: string;
  code: string;
  isUsed: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class EmailVerificationCodePrismaRepository {
  private prisma = new PrismaClient();

  async create(userId: string, email: string, code: string, expiresAt: Date): Promise<EmailVerificationCodeData> {
    // Kullanıcının aktif olmayan kodlarını iptal et
    await this.prisma.emailVerificationCode.updateMany({
      where: {
        userId,
        email,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        isUsed: true,
      },
    });

    const verificationCode = await this.prisma.emailVerificationCode.create({
      data: {
        userId,
        email,
        code,
        expiresAt,
        isUsed: false,
      },
    });

    return this.toDomain(verificationCode);
  }

  async findByCodeAndEmail(code: string, email: string): Promise<EmailVerificationCodeData | null> {
    const verificationCode = await this.prisma.emailVerificationCode.findFirst({
      where: {
        code,
        email,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return verificationCode ? this.toDomain(verificationCode) : null;
  }

  async findByUserIdAndCode(userId: string, code: string): Promise<EmailVerificationCodeData | null> {
    const verificationCode = await this.prisma.emailVerificationCode.findFirst({
      where: {
        userId,
        code,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return verificationCode ? this.toDomain(verificationCode) : null;
  }

  async markAsUsed(id: string): Promise<void> {
    await this.prisma.emailVerificationCode.update({
      where: { id },
      data: { isUsed: true },
    });
  }

  async deleteExpiredCodes(): Promise<number> {
    const result = await this.prisma.emailVerificationCode.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.prisma.emailVerificationCode.deleteMany({
      where: {
        userId,
      },
    });

    return result.count;
  }

  private toDomain(prismaCode: any): EmailVerificationCodeData {
    return {
      id: prismaCode.id,
      userId: prismaCode.userId,
      email: prismaCode.email,
      code: prismaCode.code,
      isUsed: prismaCode.isUsed,
      expiresAt: prismaCode.expiresAt,
      createdAt: prismaCode.createdAt,
      updatedAt: prismaCode.updatedAt,
    };
  }
}

