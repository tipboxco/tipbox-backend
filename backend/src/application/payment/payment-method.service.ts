import { PaymentMethod } from '../../domain/payment/payment-method.entity';
import { PaymentMethodPrismaRepository } from '../../infrastructure/repositories/payment-method-prisma.repository';
import { UserSubscriptionPrismaRepository } from '../../infrastructure/repositories/user-subscription-prisma.repository';
import logger from '../../infrastructure/logger/logger';

export const PAYMENT_ERROR_CODES = {
  CARD_IN_USE_BY_SUBSCRIPTION: 'CARD_IN_USE_BY_SUBSCRIPTION',
  CARD_NOT_FOUND: 'CARD_NOT_FOUND',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INVALID_EXPIRY: 'INVALID_EXPIRY',
  CARD_DECLINED: 'CARD_DECLINED',
} as const;

export type AddCardInput = {
  payment_token: string;
  card_alias: string;
  /** Mock/placeholder: kart bilgisi (entegrasyon öncesi) */
  last4?: string;
  brand?: string;
  expiry_month?: number;
  expiry_year?: number;
};

export class PaymentMethodService {
  constructor(
    private readonly paymentMethodRepo = new PaymentMethodPrismaRepository(),
    private readonly userSubscriptionRepo = new UserSubscriptionPrismaRepository()
  ) {}

  async addCard(userId: string, input: AddCardInput): Promise<PaymentMethod> {
    const last4 = input.last4 ?? '0000';
    const brand = input.brand ?? 'Unknown';
    const expiry_month = input.expiry_month ?? 12;
    const expiry_year = input.expiry_year ?? new Date().getFullYear() + 2;

    if (!input.last4 || !input.brand) {
      logger.warn('addCard called with missing card details, using placeholder defaults', {
        userId,
        hasLast4: !!input.last4,
        hasBrand: !!input.brand,
      });
    }
    const cards = await this.paymentMethodRepo.findByUserId(userId);
    const isDefault = cards.length === 0;
    return this.paymentMethodRepo.create({
      userId,
      cardAlias: input.card_alias,
      brand,
      last4,
      expiryMonth: expiry_month,
      expiryYear: expiry_year,
      isDefault,
      providerPaymentMethodId: input.payment_token || null,
    });
  }

  async updateCardAlias(userId: string, id: string, cardAlias: string): Promise<PaymentMethod | null> {
    const existing = await this.paymentMethodRepo.findByIdAndUserId(id, userId);
    if (!existing) return null;
    return this.paymentMethodRepo.updateCardAlias(id, userId, cardAlias);
  }

  async deleteCard(userId: string, id: string): Promise<{ success: boolean; errorCode?: string }> {
    const card = await this.paymentMethodRepo.findByIdAndUserId(id, userId);
    if (!card) {
      return { success: false, errorCode: PAYMENT_ERROR_CODES.CARD_NOT_FOUND };
    }
    const inUse = await this.userSubscriptionRepo.isPaymentMethodUsedByActiveSubscription(id);
    if (inUse) {
      return { success: false, errorCode: PAYMENT_ERROR_CODES.CARD_IN_USE_BY_SUBSCRIPTION };
    }
    const deleted = await this.paymentMethodRepo.delete(id);
    return { success: deleted };
  }
}
