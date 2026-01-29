import { Invoice } from '../../domain/payment/invoice.entity';
import { PaymentMethod } from '../../domain/payment/payment-method.entity';
import { UserSubscription } from '../../domain/payment/user-subscription.entity';
import { InvoicePrismaRepository } from '../../infrastructure/repositories/invoice-prisma.repository';
import { PaymentMethodPrismaRepository } from '../../infrastructure/repositories/payment-method-prisma.repository';
import { UserSubscriptionPrismaRepository } from '../../infrastructure/repositories/user-subscription-prisma.repository';

export type PaymentDashboardResult = {
  saved_cards: PaymentMethod[];
  active_subscription: UserSubscription | null;
  recent_invoices: Invoice[];
};

export class PaymentDashboardService {
  constructor(
    private readonly paymentMethodRepo = new PaymentMethodPrismaRepository(),
    private readonly userSubscriptionRepo = new UserSubscriptionPrismaRepository(),
    private readonly invoiceRepo = new InvoicePrismaRepository()
  ) {}

  async getDashboard(userId: string, recentInvoicesLimit = 5): Promise<PaymentDashboardResult> {
    const [saved_cards, active_subscription, recent_invoices] = await Promise.all([
      this.paymentMethodRepo.findByUserId(userId),
      this.userSubscriptionRepo.findActiveByUserId(userId),
      this.invoiceRepo.findRecentByUserId(userId, recentInvoicesLimit),
    ]);
    return { saved_cards, active_subscription, recent_invoices };
  }
}
