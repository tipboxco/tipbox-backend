import { getPrisma } from './prisma.client';

export interface EmailVerificationCodeData {
  id: string;
  userId: string | null;
  email: string;
  code: string;
  passwordHash: string | null;
  name: string | null;
  auth0Id: string | null;
  isUsed: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class EmailVerificationCodePrismaRepository {
  private prisma = getPrisma();

  async create(
    email: string, 
    code: string, 
    expiresAt: Date, 
    passwordHash?: string, 
    name?: string, 
    userId?: string,
    auth0Id?: string
  ): Promise<EmailVerificationCodeData> {
    // Aynı email için aktif olmayan kodlarını iptal et
    await this.prisma.emailVerificationCode.updateMany({
      where: {
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
        userId: userId || null,
        email,
        code,
        passwordHash: passwordHash || null,
        name: name || null,
        auth0Id: auth0Id || null,
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
      passwordHash: prismaCode.passwordHash,
      name: prismaCode.name,
      auth0Id: prismaCode.auth0Id,
      isUsed: prismaCode.isUsed,
      expiresAt: prismaCode.expiresAt,
      createdAt: prismaCode.createdAt,
      updatedAt: prismaCode.updatedAt,
    };
  }
}

