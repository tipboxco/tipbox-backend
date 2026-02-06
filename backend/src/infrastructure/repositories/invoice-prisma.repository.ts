import { Invoice } from '../../domain/payment/invoice.entity';
import { InvoiceStatus } from '../../domain/payment/invoice-status.enum';
import { getPrisma } from './prisma.client';

export type InvoiceSortBy = 'date_asc' | 'date_desc';

export class InvoicePrismaRepository {
  private prisma = getPrisma();

  async findByUserId(
    userId: string,
    options: { sortBy?: InvoiceSortBy; limit?: number; offset?: number } = {}
  ): Promise<Invoice[]> {
    const { sortBy = 'date_desc', limit = 20, offset = 0 } = options;
    const orderBy = sortBy === 'date_asc'
      ? { invoiceDate: 'asc' as const }
      : { invoiceDate: 'desc' as const };
    const rows = await this.prisma.invoice.findMany({
      where: { userId },
      orderBy,
      take: Math.min(limit, 100),
      skip: offset,
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findRecentByUserId(userId: string, take = 5): Promise<Invoice[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { userId },
      orderBy: { invoiceDate: 'desc' },
      take,
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: string): Promise<Invoice | null> {
    const row = await this.prisma.invoice.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<Invoice | null> {
    const row = await this.prisma.invoice.findFirst({
      where: { id, userId },
    });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: {
    id: string;
    userId: string;
    subscriptionId: string | null;
    planId: string | null;
    amount: number;
    currency: string;
    status: string;
    description: string | null;
    invoiceDate: Date;
    paidAt: Date | null;
    externalId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Invoice {
    return new Invoice(
      row.id,
      row.userId,
      row.subscriptionId,
      row.planId,
      row.amount,
      row.currency,
      row.status as InvoiceStatus,
      row.description,
      row.invoiceDate,
      row.paidAt,
      row.externalId,
      row.createdAt,
      row.updatedAt
    );
  }
}
