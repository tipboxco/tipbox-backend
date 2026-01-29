import { SubscriptionPlan } from '../../domain/payment/subscription-plan.entity';
import { SubscriptionPlanPrismaRepository } from '../../infrastructure/repositories/subscription-plan-prisma.repository';

export class SubscriptionPlanService {
  constructor(private readonly planRepo = new SubscriptionPlanPrismaRepository()) {}

  async listPlans(): Promise<SubscriptionPlan[]> {
    return this.planRepo.findActive(true);
  }
}
