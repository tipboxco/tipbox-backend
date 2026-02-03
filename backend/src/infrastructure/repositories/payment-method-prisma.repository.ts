import { PaymentMethod } from '../../domain/payment/payment-method.entity';
import { getPrisma } from './prisma.client';

export class PaymentMethodPrismaRepository {
  private prisma = getPrisma();

  async findByUserId(userId: string): Promise<PaymentMethod[]> {
    const rows = await this.prisma.paymentMethod.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: string): Promise<PaymentMethod | null> {
    const row = await this.prisma.paymentMethod.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<PaymentMethod | null> {
    const row = await this.prisma.paymentMethod.findFirst({
      where: { id, userId },
    });
    return row ? this.toDomain(row) : null;
  }

  async create(data: {
    userId: string;
    cardAlias: string;
    brand: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
    isDefault?: boolean;
    providerPaymentMethodId?: string | null;
  }): Promise<PaymentMethod> {
    if (data.isDefault) {
      await this.prisma.paymentMethod.updateMany({
        where: { userId: data.userId },
        data: { isDefault: false },
      });
    }
    const row = await this.prisma.paymentMethod.create({
      data: {
        userId: data.userId,
        cardAlias: data.cardAlias,
        brand: data.brand,
        last4: data.last4,
        expiryMonth: data.expiryMonth,
        expiryYear: data.expiryYear,
        isDefault: data.isDefault ?? false,
        providerPaymentMethodId: data.providerPaymentMethodId ?? null,
      },
    });
    return this.toDomain(row);
  }

  async updateCardAlias(id: string, userId: string, cardAlias: string): Promise<PaymentMethod | null> {
    const row = await this.prisma.paymentMethod.updateMany({
      where: { id, userId },
      data: { cardAlias },
    });
    if (row.count === 0) return null;
    const updated = await this.prisma.paymentMethod.findUnique({ where: { id } });
    return updated ? this.toDomain(updated) : null;
  }

  async setDefault(id: string, userId: string): Promise<PaymentMethod | null> {
    await this.prisma.paymentMethod.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
    const row = await this.prisma.paymentMethod.update({
      where: { id },
      data: { isDefault: true },
    });
    return this.toDomain(row);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.paymentMethod.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  private toDomain(row: {
    id: string;
    userId: string;
    cardAlias: string;
    brand: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
    isDefault: boolean;
    providerPaymentMethodId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PaymentMethod {
    return new PaymentMethod(
      row.id,
      row.userId,
      row.cardAlias,
      row.brand,
      row.last4,
      row.expiryMonth,
      row.expiryYear,
      row.isDefault,
      row.providerPaymentMethodId,
      row.createdAt,
      row.updatedAt
    );
  }
}
