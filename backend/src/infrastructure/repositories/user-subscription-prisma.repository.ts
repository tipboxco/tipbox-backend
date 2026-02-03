import { SubscriptionStatus } from '../../domain/payment/subscription-status.enum';
import { UserSubscription } from '../../domain/payment/user-subscription.entity';
import { getPrisma } from './prisma.client';

export class UserSubscriptionPrismaRepository {
  private prisma = getPrisma();

  async findActiveByUserId(userId: string): Promise<UserSubscription | null> {
    const row = await this.prisma.userSubscription.findFirst({
      where: { userId, status: { in: ['active', 'trialing'] } },
      orderBy: { currentPeriodEnd: 'desc' },
      include: {
        plan: true,
      },
    });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<UserSubscription | null> {
    const row = await this.prisma.userSubscription.findUnique({
      where: { id },
      include: { plan: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async isPaymentMethodUsedByActiveSubscription(paymentMethodId: string): Promise<boolean> {
    const count = await this.prisma.userSubscription.count({
      where: {
        paymentMethodId,
        status: { in: ['active', 'trialing'] },
      },
    });
    return count > 0;
  }

  private toDomain(row: {
    id: string;
    userId: string;
    planId: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    paymentMethodId: string | null;
    canceledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    plan?: { name: string; benefits: unknown };
  }): UserSubscription {
    const benefits = row.plan?.benefits != null && Array.isArray(row.plan.benefits)
      ? (row.plan.benefits as string[])
      : undefined;
    return new UserSubscription(
      row.id,
      row.userId,
      row.planId,
      row.status as SubscriptionStatus,
      row.currentPeriodStart,
      row.currentPeriodEnd,
      row.paymentMethodId,
      row.canceledAt,
      row.createdAt,
      row.updatedAt,
      row.plan?.name,
      benefits
    );
  }
}
