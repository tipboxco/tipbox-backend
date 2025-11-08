export interface InventoryListItemResponse {
  id: string;
  brand: {
    name: string;
    model: string;
    specs: string;
  };
  image: string | null;
  reviews: Array<{
    title: string;
    description: string;
    rating: number;
  }>;
  tags: string[];
}

export interface UpdateInventoryItemDto {
  productId?: string;
  hasOwned?: boolean;
  experienceSummary?: string;
}

export interface InventoryItemResponse {
  id: string;
  userId: string;
  productId: string;
  hasOwned: boolean;
  experienceSummary: string | null;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    brand: string | null;
    description: string | null;
  };
}

