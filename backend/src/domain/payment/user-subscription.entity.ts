import { SubscriptionStatus } from './subscription-status.enum';

export class UserSubscription {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly planId: string,
    public readonly status: SubscriptionStatus,
    public readonly currentPeriodStart: Date,
    public readonly currentPeriodEnd: Date,
    public readonly paymentMethodId: string | null,
    public readonly canceledAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly planName?: string,
    public readonly benefits?: string[]
  ) {}
}
