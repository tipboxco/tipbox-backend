export interface Product {
  parent_asin: string;
  title: string;
  description: string;
  main_category: string;
  categories: string[];
  store: string; // brand/store name
  average_rating: number | null;
  rating_number: number | null;
  price: number | null;
  features: string[];
  details: Record<string, string>;
  image: string;
  date_first_available: string;
  filename: string;
}

export interface CsvProduct {
  parent_asin?: string;
  title: string;
  description?: string;
  main_category?: string;
  categories?: string;
  store: string; // brand name - required
  average_rating?: string;
  rating_number?: string;
  price?: string;
  features?: string;
  details?: string;
  image?: string;
  date_first_available?: string;
  filename?: string;
}

export interface BrandGroup {
  brand: string;
  products: Product[];
  count: number;
}

export interface DatasetConfig {
  hfToken: string;
  datasetId: string;
}
