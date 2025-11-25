import { ExperienceStatus } from '../../domain/content/experience-status.enum';
import { ExperienceType } from '../../domain/content/experience-type.enum';

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

export interface InventoryExperienceRequest {
  type: ExperienceType;
  content: string;
  rating: number;
}

export interface CreateInventoryRequest {
  productId: string;
  selectedDurationId: string;
  selectedLocationId: string;
  selectedPurposeId: string;
  content: string;
  experience: InventoryExperienceRequest[];
  status: ExperienceStatus;
  images?: string[];
  userId?: string;
}

