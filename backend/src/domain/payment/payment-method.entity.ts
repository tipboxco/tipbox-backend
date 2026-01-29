export class PaymentMethod {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly cardAlias: string,
    public readonly brand: string,
    public readonly last4: string,
    public readonly expiryMonth: number,
    public readonly expiryYear: number,
    public readonly isDefault: boolean,
    public readonly providerPaymentMethodId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}
