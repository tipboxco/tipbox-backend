import { get, patch, del } from './client';

const prefix = '/admin';

export interface AiExperienceSplitStatsResponse {
  total: number;
  edited: number;
  unedited: number;
  avgTokensUsed: number;
  avgProcessingTimeMs: number;
  avgPriceAndShoppingRating: number;
  avgProductAndUsageRating: number;
  byModel: Record<string, number>;
}

export interface AiExperienceSplitListItem {
  id: string;
  userId: string;
  username: string | null;
  userEmail: string | null;
  productId: string | null;
  productName: string | null;
  priceAndShoppingRating: number | null;
  productAndUsageRating: number | null;
  isEdited: boolean;
  model: string;
  promptVersion: string;
  tokensUsed: number | null;
  processingTimeMs: number | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAiExperienceSplitsStats() {
  return get<AiExperienceSplitStatsResponse>(`${prefix}/ai-experience-splits/stats`);
}

export async function fetchAiExperienceSplits(params?: {
  limit?: number;
  offset?: number;
  userId?: string;
  productId?: string;
  isEdited?: boolean;
  model?: string;
  promptVersion?: string;
  minRating?: number;
  sort?:
    | 'createdAt'
    | 'priceAndShoppingRating'
    | 'productAndUsageRating'
    | 'tokensUsed'
    | 'processingTimeMs';
  order?: 'asc' | 'desc';
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    limit: params?.limit ?? 20,
    offset: params?.offset ?? 0,
    sort: params?.sort ?? 'createdAt',
    order: params?.order ?? 'desc',
  };
  if (params?.userId) query.userId = params.userId;
  if (params?.productId) query.productId = params.productId;
  if (params?.isEdited !== undefined) query.isEdited = params.isEdited;
  if (params?.model) query.model = params.model;
  if (params?.promptVersion) query.promptVersion = params.promptVersion;
  if (params?.minRating !== undefined) query.minRating = params.minRating;
  return get<AiExperienceSplitListItem[]>(`${prefix}/ai-experience-splits`, query);
}

export async function updateAiExperienceSplit(
  id: string,
  body: {
    priceAndShopping?: string | null;
    productAndUsage?: string | null;
    priceAndShoppingRating?: number | null;
    productAndUsageRating?: number | null;
    isEdited?: boolean;
  }
) {
  return patch<{
    id: string;
    priceAndShopping: string | null;
    productAndUsage: string | null;
    priceAndShoppingRating: number | null;
    productAndUsageRating: number | null;
    isEdited: boolean;
    updatedAt: string;
  }>(`${prefix}/ai-experience-splits/${id}`, body);
}

export async function deleteAiExperienceSplit(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/ai-experience-splits/${id}`);
}
