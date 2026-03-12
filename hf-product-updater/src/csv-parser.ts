import fs from 'fs';
import { parse } from 'csv-parse/sync';
import type { CsvProduct, Product } from './types';

export function parseCsvFile(filePath: string): Product[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as CsvProduct[];

  return records.map((row) => mapCsvToProduct(row));
}

function mapCsvToProduct(csv: CsvProduct): Product {
  return {
    parent_asin: csv.parent_asin || generateAsin(),
    title: csv.title || '',
    description: csv.description || '',
    main_category: csv.main_category || '',
    categories: csv.categories ? parseJsonArray(csv.categories) : [],
    store: csv.store || '',
    average_rating: csv.average_rating ? parseFloat(csv.average_rating) : null,
    rating_number: csv.rating_number ? parseInt(csv.rating_number, 10) : null,
    price: csv.price ? parseFloat(csv.price.replace(/[^0-9.]/g, '')) : null,
    features: csv.features ? parseJsonArray(csv.features) : [],
    details: csv.details ? parseJsonObject(csv.details) : {},
    image: csv.image || '',
    date_first_available: csv.date_first_available || new Date().toISOString().split('T')[0],
    filename: csv.filename || '',
  };
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    // comma-separated fallback
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }
}

function parseJsonObject(value: string): Record<string, string> {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function generateAsin(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'B0';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
