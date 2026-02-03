import { InvoiceStatus } from './invoice-status.enum';

export class Invoice {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly subscriptionId: string | null,
    public readonly planId: string | null,
    public readonly amount: number,
    public readonly currency: string,
    public readonly status: InvoiceStatus,
    public readonly description: string | null,
    public readonly invoiceDate: Date,
    public readonly paidAt: Date | null,
    public readonly externalId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
}
