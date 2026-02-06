import { SubscriptionPlanPeriod } from './subscription-plan-period.enum';

export class SubscriptionPlan {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly price: number,
    public readonly currency: string,
    public readonly period: SubscriptionPlanPeriod,
    public readonly benefits: string[],
    public readonly isActive: boolean,
    public readonly displayOrder: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}
