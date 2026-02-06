import { Invoice } from '../../domain/payment/invoice.entity';
import { InvoicePrismaRepository, InvoiceSortBy } from '../../infrastructure/repositories/invoice-prisma.repository';

export type ListInvoicesOptions = {
  sort_by?: InvoiceSortBy;
  limit?: number;
  offset?: number;
};

export class InvoiceService {
  constructor(private readonly invoiceRepo = new InvoicePrismaRepository()) {}

  async listInvoices(userId: string, options: ListInvoicesOptions = {}): Promise<Invoice[]> {
    return this.invoiceRepo.findByUserId(userId, {
      sortBy: options.sort_by ?? 'date_desc',
      limit: options.limit ?? 20,
      offset: options.offset ?? 0,
    });
  }
}
