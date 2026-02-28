export interface MedusaProduct {
  id: string;
  title: string;
  description?: string;
  handle?: string;
  status?: string;
  images?: Array<{
    id: string;
    url: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface MedusaCategory {
  id: string;
  name: string;
  handle?: string;
  description?: string;
  parent_category_id?: string | null;
  category_children?: MedusaCategory[];
  created_at?: string;
  updated_at?: string;
}

export interface FilterableOptionsType {
  [key: string]: string[];
}

export interface FilterableProductsResponse {
  products: MedusaProduct[];
  total: number;
  filterable_options: FilterableOptionsType | null;
}

import logger from '../../infrastructure/logger/logger';

export class MedusaService {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;
  private readonly pageSize: number;

  constructor() {
    const medusaUrl =
      process.env.MEDUSA_API_URL ||
      process.env.EXPO_PUBLIC_MEDUSA_URL ||
      '';
    this.baseUrl = medusaUrl.replace(/\/$/, '');

    if (!this.baseUrl) {
      logger.warn('MEDUSA_API_URL is not set. Medusa service will not work.');
    }

    this.apiKey =
      process.env.MEDUSA_API_KEY ||
      process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY ||
      null;

    this.pageSize = 500;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['x-publishable-api-key'] = this.apiKey;
    }

    return headers;
  }

  async getProductById(productId: string): Promise<MedusaProduct | null> {
    try {
      const response = await fetch(`${this.baseUrl}/store/products/${productId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Medusa API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      let product: Record<string, unknown> | undefined;
      if ('product' in data && data.product && typeof data.product === 'object') {
        product = data.product as Record<string, unknown>;
      } else if ('id' in data && 'title' in data) {
        product = data as Record<string, unknown>;
      }
      if (!product) {
        return null;
      }
      // Only pick required fields
      return {
        id: product.id as string,
        title: product.title as string,
        description: product.description as string | undefined,
        handle: product.handle as string | undefined,
        status: product.status as string | undefined,
        images: product.images as Array<{ id: string; url: string }> | undefined,
        metadata: product.metadata as Record<string, unknown> | undefined,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch product from Medusa: ${error.message}`);
      }
      throw new Error('Failed to fetch product from Medusa: Unknown error');
    }
  }

  async getCategoriesByParent(
    parentId: string | null,
    options?: { limit?: number; includeDescendantsTree?: boolean }
  ): Promise<MedusaCategory[]> {
    try {
      const limit = options?.limit || this.pageSize;
      const includeDescendantsTree = options?.includeDescendantsTree || false;

      let url = `${this.baseUrl}/store/product-categories?`;
      if (parentId) {
        url += `parent_category_id=${parentId}&`;
      } else {
        url += `parent_category_id=null&`;
      }
      url += `limit=${limit}&include_descendants_tree=${includeDescendantsTree}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return [];
      }

      return (await response.json()) as MedusaCategory[];
    } catch (error) {
      return [];
    }
  }

  /**
   * Fetch products by category using the /store/custom/filterable-products endpoint if available,
   * with fallback to /store/products if failed. Supports filterable options and metadata filtering.
   */
  async getFilterableProductsByCategoryId(
    categoryId: string,
    options?: {
      searchQuery?: string;
      pageSize?: number;
      offset?: number;
      metadataFilters?: Record<string, string[]>;
    }
  ): Promise<FilterableProductsResponse> {
    const {
      searchQuery = '',
      pageSize = 30,
      offset = 0,
      metadataFilters = {},
    } = options || {};

    try {
      let url = `${this.baseUrl}/store/custom/filterable-products?category_id=${categoryId}&limit=${pageSize}&offset=${offset}`;
      if (searchQuery) {
        url += `&q=${encodeURIComponent(searchQuery)}`;
      }
      if (metadataFilters && Object.keys(metadataFilters).length > 0) {
        Object.entries(metadataFilters).forEach(([key, values]) => {
          if (values.length > 0) {
            url += `&metadata[${key}]=${encodeURIComponent(values.join(','))}`;
          }
        });
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'x-publishable-api-key': this.apiKey } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          products: data.products || [],
          total: data.count || data.products?.length || 0,
          filterable_options: data.filterable_options || null,
        };
      }

      // Fallback
      let fallbackUrl = `${this.baseUrl}/store/products?category_id[]=${categoryId}&limit=${pageSize}&offset=${offset}`;
      if (searchQuery) {
        fallbackUrl += `&q=${encodeURIComponent(searchQuery)}`;
      }

      const fallbackResponse = await fetch(fallbackUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'x-publishable-api-key': this.apiKey } : {}),
        },
      });

      if (!fallbackResponse.ok) {
        logger.error({ message: '[getFilterableProductsByCategoryId] Error', status: fallbackResponse.status });
        return { products: [], total: 0, filterable_options: null };
      }

      const fallbackData = await fallbackResponse.json();

      return {
        products: fallbackData.products || [],
        total: fallbackData.count || fallbackData.products?.length || 0,
        filterable_options: null,
      };
    } catch (error) {
      logger.error({ message: '[getFilterableProductsByCategoryId] Exception', error: error instanceof Error ? error.message : String(error) });
      return { products: [], total: 0, filterable_options: null };
    }
  }
}
