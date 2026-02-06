/**
 * Request/query validation schemas for payment endpoints.
 * Optional: use Zod/Joi for runtime validation; types are defined in payment.dto.ts.
 */

export const INVOICE_SORT_VALUES = ['date_asc', 'date_desc'] as const;
export type InvoiceSortQuery = (typeof INVOICE_SORT_VALUES)[number];

export const DEFAULT_INVOICE_LIMIT = 20;
export const MAX_INVOICE_LIMIT = 100;

export function parseInvoiceSort(sort_by: unknown): InvoiceSortQuery {
  if (sort_by === 'date_asc' || sort_by === 'date_desc') return sort_by;
  return 'date_desc';
}

export function parseLimit(limit: unknown, max = MAX_INVOICE_LIMIT): number {
  const n = Number(limit);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_INVOICE_LIMIT;
  return Math.min(Math.floor(n), max);
}

export function parseOffset(offset: unknown): number {
  const n = Number(offset);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}
