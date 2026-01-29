/**
 * @openapi
 * components:
 *   schemas:
 *     PaymentMethodResponse:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         card_alias: { type: string, example: "Work Card" }
 *         brand: { type: string, example: "Visa" }
 *         last4: { type: string, example: "4242" }
 *         expiry_month: { type: number, example: 12 }
 *         expiry_year: { type: number, example: 2027 }
 *         is_default: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     SubscriptionResponse:
 *       type: object
 *       properties:
 *         current_plan_id: { type: string }
 *         plan_name: { type: string }
 *         status: { type: string, enum: [active, trialing, canceled, past_due] }
 *         next_billing_date: { type: string, format: date-time }
 *         benefits: { type: array, items: { type: string } }
 *     InvoiceResponse:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         amount: { type: number }
 *         currency: { type: string }
 *         date: { type: string, format: date-time }
 *         status: { type: string, enum: [Paid, Pending, Failed] }
 *         description: { type: string, nullable: true }
 *     PaymentDashboardResponse:
 *       type: object
 *       properties:
 *         saved_cards:
 *           type: array
 *           items: { $ref: '#/components/schemas/PaymentMethodResponse' }
 *         active_subscription: { $ref: '#/components/schemas/SubscriptionResponse', nullable: true }
 *         recent_invoices:
 *           type: array
 *           items: { $ref: '#/components/schemas/InvoiceResponse' }
 *     AddPaymentMethodRequest:
 *       type: object
 *       required: [payment_token, card_alias]
 *       properties:
 *         payment_token: { type: string, description: "Ödeme sağlayıcısından alınan güvenli token" }
 *         card_alias: { type: string, example: "Work Card" }
 *     UpdatePaymentMethodRequest:
 *       type: object
 *       required: [card_alias]
 *       properties:
 *         card_alias: { type: string }
 *     SubscriptionPlanResponse:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         price: { type: number }
 *         currency: { type: string }
 *         period: { type: string, enum: [MONTHLY, YEARLY] }
 *         benefits: { type: array, items: { type: string } }
 */

export interface PaymentMethodResponse {
  id: string;
  card_alias: string;
  brand: string;
  last4: string;
  expiry_month: number;
  expiry_year: number;
  is_default: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionResponse {
  current_plan_id: string;
  plan_name: string;
  status: string;
  next_billing_date: string;
  benefits: string[];
}

export interface InvoiceResponse {
  id: string;
  amount: number;
  currency: string;
  date: string;
  status: string;
  description: string | null;
}

export interface PaymentDashboardResponse {
  saved_cards: PaymentMethodResponse[];
  active_subscription: SubscriptionResponse | null;
  recent_invoices: InvoiceResponse[];
}

export interface AddPaymentMethodRequest {
  payment_token: string;
  card_alias: string;
}

export interface UpdatePaymentMethodRequest {
  card_alias: string;
}

export interface SubscriptionPlanResponse {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string;
  benefits: string[];
}
