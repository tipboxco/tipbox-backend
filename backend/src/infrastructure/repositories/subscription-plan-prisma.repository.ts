import { SubscriptionPlan } from '../../domain/payment/subscription-plan.entity';
import { SubscriptionPlanPeriod } from '../../domain/payment/subscription-plan-period.enum';
import { getPrisma } from './prisma.client';

export class SubscriptionPlanPrismaRepository {
  private prisma = getPrisma();

  async findActive(orderByDisplayOrder = true): Promise<SubscriptionPlan[]> {
    const rows = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: orderByDisplayOrder ? { displayOrder: 'asc' } : undefined,
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: string): Promise<SubscriptionPlan | null> {
    const row = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: {
    id: string;
    name: string;
    price: number;
    currency: string;
    period: string;
    benefits: unknown;
    isActive: boolean;
    displayOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): SubscriptionPlan {
    const benefits = Array.isArray(row.benefits) ? (row.benefits as string[]) : [];
    return new SubscriptionPlan(
      row.id,
      row.name,
      row.price,
      row.currency,
      row.period as SubscriptionPlanPeriod,
      benefits,
      row.isActive,
      row.displayOrder,
      row.createdAt,
      row.updatedAt
    );
  }
}
