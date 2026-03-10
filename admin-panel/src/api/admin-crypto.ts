import { get, post, patch, del } from './client';
import type { ApiResponse } from './client';

// ==================== Type Interfaces ====================

/* ========== Wallets ========== */

export type AdminWalletStatsResponse = {
  total: number;
  connected: number;
  disconnected: number;
  totalBalance: number;
  totalLockedBalance: number;
  byProvider: Record<string, number>;
};

export type AdminWalletListItem = {
  id: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  publicAddress: string;
  provider: string;
  isConnected: boolean;
  balance: number;
  lockedBalance: number;
  transactionCount: number;
  createdAt: string;
};

export type AdminWalletDetailResponse = AdminWalletListItem & {
  updatedAt: string;
  recentTransactions: AdminTransactionListItem[];
};

export type AdjustWalletBalanceInput = {
  amount: number;
  reason: string;
  adjustType: 'ADD' | 'SUBTRACT';
};

/* ========== Transactions ========== */

export type AdminTransactionStatsResponse = {
  total: number;
  created: number;
  pending: number;
  confirmed: number;
  failed: number;
  totalVolume: number;
  revenueThisMonth: number;
};

export type AdminTransactionListItem = {
  id: string;
  walletId: string;
  userId: string;
  userEmail: string | null;
  username: string | null;
  type: string;
  amount: number;
  status: string;
  transactionHash: string | null;
  metadata: unknown;
  createdAt: string;
};

export type AdminTransactionDetailResponse = AdminTransactionListItem & {
  updatedAt: string;
  wallet: {
    id: string;
    publicAddress: string;
    provider: string;
  };
};

/* ========== Tips Transfers ========== */

export type AdminTipsStatsResponse = {
  total: number;
  totalVolume: number;
  volumeThisMonth: number;
  thisWeek: number;
  avgAmount: number;
  topSenders: {
    userId: string;
    username: string | null;
    totalSent: number;
    count: number;
  }[];
  topReceivers: {
    userId: string;
    username: string | null;
    totalReceived: number;
    count: number;
  }[];
};

export type AdminTipsListItem = {
  id: string;
  fromUserId: string;
  fromEmail: string | null;
  fromUsername: string | null;
  toUserId: string;
  toEmail: string | null;
  toUsername: string | null;
  amount: number;
  reason: string | null;
  createdAt: string;
};

export type AdminTipsAnalyticsResponse = {
  totalVolume: number;
  totalTransfers: number;
  avgTransferAmount: number;
  volumeByDay: {
    date: string;
    volume: number;
    count: number;
  }[];
  volumeByReason: {
    reason: string;
    volume: number;
    count: number;
  }[];
};

/* ========== NFTs ========== */

export type AdminNFTStatsResponse = {
  total: number;
  byType: Record<string, number>;
  byRarity: Record<string, number>;
  totalTransactions: number;
  activeListings: number;
  mostViewedNFTs: {
    nftId: string;
    name: string;
    viewCount: number;
  }[];
};

export type AdminNFTListItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string;
  type: string;
  rarity: string;
  isTransferable: boolean;
  currentOwnerId: string | null;
  currentOwnerUsername: string | null;
  viewCount: number;
  transactionCount: number;
  createdAt: string;
};

export type AdminNFTDetailResponse = AdminNFTListItem & {
  updatedAt: string;
  attributes: {
    id: string;
    key: string;
    value: string;
  }[];
  currentOwner: {
    id: string;
    email: string | null;
    username: string | null;
  } | null;
  recentTransactions: {
    id: string;
    fromUserId: string | null;
    fromUsername: string | null;
    toUserId: string;
    toUsername: string | null;
    transactionType: string;
    price: number | null;
    createdAt: string;
  }[];
  marketListings: {
    id: string;
    price: number;
    status: string;
    listedAt: string;
  }[];
};

export type CreateNFTInput = {
  name: string;
  description?: string | null;
  imageUrl: string;
  type: string;
  rarity: string;
  isTransferable?: boolean;
  currentOwnerId?: string | null;
  attributes?: {
    key: string;
    value: string;
  }[];
};

export type UpdateNFTInput = Partial<Omit<CreateNFTInput, 'attributes'>>;

export type TransferNFTInput = {
  toUserId: string;
  reason?: string | null;
};

/* ========== NFT Transactions ========== */

export type AdminNFTTransactionListItem = {
  id: string;
  nftId: string;
  nftName: string;
  fromUserId: string | null;
  fromUsername: string | null;
  toUserId: string;
  toUsername: string | null;
  transactionType: string;
  price: number | null;
  transactionHash: string | null;
  createdAt: string;
};

/* ========== NFT Marketplace ========== */

export type AdminNFTMarketplaceStatsResponse = {
  totalListings: number;
  active: number;
  sold: number;
  cancelled: number;
  totalVolume: number;
  volumeThisMonth: number;
  floorPrice: number | null;
};

export type AdminNFTMarketListingListItem = {
  id: string;
  nftId: string;
  nftName: string;
  nftImageUrl: string;
  listedByUserId: string;
  listedByUsername: string | null;
  price: number;
  status: string;
  listedAt: string;
  createdAt: string;
};

export type AdminNFTMarketListingDetailResponse = AdminNFTMarketListingListItem & {
  updatedAt: string;
  nft: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string;
    type: string;
    rarity: string;
  };
  listedBy: {
    id: string;
    email: string | null;
    username: string | null;
  };
};

export type ModerateListingInput = {
  status: 'ACTIVE' | 'CANCELLED';
  reason?: string | null;
};

/* ========== Query Parameters ========== */

export type WalletsQueryParams = {
  limit?: number;
  offset?: number;
  userId?: string;
  provider?: string;
  isConnected?: boolean;
  minBalance?: number;
  maxBalance?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type TransactionsQueryParams = {
  limit?: number;
  offset?: number;
  walletId?: string;
  userId?: string;
  type?: string;
  status?: string;
  minAmount?: number;
  maxAmount?: number;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type TipsQueryParams = {
  limit?: number;
  offset?: number;
  fromUserId?: string;
  toUserId?: string;
  minAmount?: number;
  maxAmount?: number;
  reason?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type NFTQueryParams = {
  limit?: number;
  offset?: number;
  search?: string;
  type?: string;
  rarity?: string;
  currentOwnerId?: string;
  isTransferable?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type NFTTransactionsQueryParams = {
  limit?: number;
  offset?: number;
  nftId?: string;
  fromUserId?: string;
  toUserId?: string;
  transactionType?: string;
  sort?: string;
  order?: 'asc' | 'desc';
};

export type NFTMarketListingsQueryParams = {
  limit?: number;
  offset?: number;
  nftId?: string;
  listedByUserId?: string;
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  order?: 'asc' | 'desc';
};

// ==================== API Functions ====================

/* ========== Wallets ========== */

export async function fetchWalletStats(): Promise<ApiResponse<AdminWalletStatsResponse>> {
  return get<AdminWalletStatsResponse>('/admin/wallets/stats');
}

export async function fetchWallets(
  params: WalletsQueryParams = {}
): Promise<ApiResponse<AdminWalletListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    userId: params.userId,
    provider: params.provider,
    isConnected: params.isConnected,
    minBalance: params.minBalance,
    maxBalance: params.maxBalance,
    search: params.search,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminWalletListItem[]>('/admin/wallets', query);
}

export async function fetchWallet(id: string): Promise<ApiResponse<AdminWalletDetailResponse>> {
  return get<AdminWalletDetailResponse>(`/admin/wallets/${id}`);
}

export async function adjustWalletBalance(
  id: string,
  data: AdjustWalletBalanceInput
): Promise<ApiResponse<AdminWalletDetailResponse>> {
  return post<AdminWalletDetailResponse>(`/admin/wallets/${id}/adjust`, data);
}

export async function disconnectWallet(id: string): Promise<ApiResponse<void>> {
  return post<void>(`/admin/wallets/${id}/disconnect`, {});
}

/* ========== Transactions ========== */

export async function fetchTransactionStats(): Promise<
  ApiResponse<AdminTransactionStatsResponse>
> {
  return get<AdminTransactionStatsResponse>('/admin/wallets/transactions/stats');
}

export async function fetchTransactions(
  params: TransactionsQueryParams = {}
): Promise<ApiResponse<AdminTransactionListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    walletId: params.walletId,
    userId: params.userId,
    type: params.type,
    status: params.status,
    minAmount: params.minAmount,
    maxAmount: params.maxAmount,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminTransactionListItem[]>('/admin/wallets/transactions', query);
}

export async function fetchTransaction(
  id: string
): Promise<ApiResponse<AdminTransactionDetailResponse>> {
  return get<AdminTransactionDetailResponse>(`/admin/wallets/transactions/${id}`);
}

/* ========== Tips Transfers ========== */

export async function fetchTipsStats(): Promise<ApiResponse<AdminTipsStatsResponse>> {
  return get<AdminTipsStatsResponse>('/admin/wallets/tips/stats');
}

export async function fetchTipsTransfers(
  params: TipsQueryParams = {}
): Promise<ApiResponse<AdminTipsListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    fromUserId: params.fromUserId,
    toUserId: params.toUserId,
    minAmount: params.minAmount,
    maxAmount: params.maxAmount,
    reason: params.reason,
    search: params.search,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminTipsListItem[]>('/admin/wallets/tips', query);
}

export async function fetchTipsAnalytics(
  startDate?: string,
  endDate?: string
): Promise<ApiResponse<AdminTipsAnalyticsResponse>> {
  const query = { startDate, endDate };
  return get<AdminTipsAnalyticsResponse>('/admin/wallets/tips/analytics', query);
}

export async function createTipsTransfer(data: {
  fromUserId: string;
  toUserId: string;
  amount: number;
  reason?: string | null;
}): Promise<ApiResponse<AdminTipsListItem>> {
  return post<AdminTipsListItem>('/admin/wallets/tips', data);
}

export async function bulkTipsTransfer(data: {
  fromUserId: string;
  recipients: { userId: string; amount: number }[];
  reason?: string | null;
}): Promise<ApiResponse<{ message: string; count: number }>> {
  return post<{ message: string; count: number }>('/admin/wallets/tips/bulk', data);
}

/* ========== NFTs ========== */

export async function fetchNFTStats(): Promise<ApiResponse<AdminNFTStatsResponse>> {
  return get<AdminNFTStatsResponse>('/admin/nft/stats');
}

export async function fetchNFTs(
  params: NFTQueryParams = {}
): Promise<ApiResponse<AdminNFTListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    search: params.search,
    type: params.type,
    rarity: params.rarity,
    currentOwnerId: params.currentOwnerId,
    isTransferable: params.isTransferable,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminNFTListItem[]>('/admin/nft', query);
}

export async function fetchNFT(id: string): Promise<ApiResponse<AdminNFTDetailResponse>> {
  return get<AdminNFTDetailResponse>(`/admin/nft/${id}`);
}

export async function createNFT(data: CreateNFTInput): Promise<ApiResponse<AdminNFTDetailResponse>> {
  return post<AdminNFTDetailResponse>('/admin/nft', data);
}

export async function updateNFT(
  id: string,
  data: UpdateNFTInput
): Promise<ApiResponse<AdminNFTDetailResponse>> {
  return patch<AdminNFTDetailResponse>(`/admin/nft/${id}`, data);
}

export async function deleteNFT(id: string): Promise<ApiResponse<void>> {
  return del<void>(`/admin/nft/${id}`);
}

export async function transferNFT(
  id: string,
  data: TransferNFTInput
): Promise<ApiResponse<{ message: string }>> {
  return post<{ message: string }>(`/admin/nft/${id}/transfer`, data);
}

/* ========== NFT Transactions ========== */

export async function fetchNFTTransactions(
  params: NFTTransactionsQueryParams = {}
): Promise<ApiResponse<AdminNFTTransactionListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    nftId: params.nftId,
    fromUserId: params.fromUserId,
    toUserId: params.toUserId,
    transactionType: params.transactionType,
    sort: params.sort ?? 'createdAt',
    order: params.order ?? 'desc',
  };
  return get<AdminNFTTransactionListItem[]>('/admin/nft/transactions', query);
}

/* ========== NFT Marketplace ========== */

export async function fetchNFTMarketplaceStats(): Promise<
  ApiResponse<AdminNFTMarketplaceStatsResponse>
> {
  return get<AdminNFTMarketplaceStatsResponse>('/admin/nft/marketplace/stats');
}

export async function fetchNFTMarketListings(
  params: NFTMarketListingsQueryParams = {}
): Promise<ApiResponse<AdminNFTMarketListingListItem[]>> {
  const query = {
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    nftId: params.nftId,
    listedByUserId: params.listedByUserId,
    status: params.status,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    sort: params.sort ?? 'listedAt',
    order: params.order ?? 'desc',
  };
  return get<AdminNFTMarketListingListItem[]>('/admin/nft/marketplace', query);
}

export async function fetchNFTMarketListing(
  id: string
): Promise<ApiResponse<AdminNFTMarketListingDetailResponse>> {
  return get<AdminNFTMarketListingDetailResponse>(`/admin/nft/marketplace/${id}`);
}

export async function moderateNFTListing(
  id: string,
  data: ModerateListingInput
): Promise<ApiResponse<{ message: string }>> {
  return patch<{ message: string }>(`/admin/nft/marketplace/${id}/moderate`, data);
}

// ==================== Aliases for Backward Compatibility ====================

/* NFT Marketplace Aliases */
export type AdminMarketplaceStatsResponse = AdminNFTMarketplaceStatsResponse;
export type AdminMarketplaceListingItem = AdminNFTMarketListingListItem;
export type AdminMarketplaceListingDetailResponse = AdminNFTMarketListingDetailResponse;

export const fetchMarketplaceStats = fetchNFTMarketplaceStats;
export const fetchMarketplaceListings = fetchNFTMarketListings;
export const fetchMarketplaceListing = fetchNFTMarketListing;

export async function delistNFT(listingId: string): Promise<ApiResponse<void>> {
  return patch<void>(`/admin/nft/marketplace/${listingId}/moderate`, {
    status: 'CANCELLED',
    reason: 'Delisted by admin',
  });
}

/* Token Transfers Aliases (Tips Transfers) */
export type AdminTokenTransferStatsResponse = AdminTipsStatsResponse;
export type AdminTokenTransferListItem = AdminTipsListItem;
export type AdminTokenTransferDetailResponse = AdminTipsListItem; // Tips doesn't have a detail response
export type CreateTokenTransferInput = {
  fromUserId: string;
  toUserId: string;
  amount: number;
  reason?: string | null;
};

export const fetchTokenTransferStats = fetchTipsStats;
export const fetchTokenTransfers = fetchTipsTransfers;
export const fetchTokenTransfer = async (id: string): Promise<ApiResponse<AdminTipsListItem>> => {
  // Tips doesn't have a single fetch endpoint, so this is a placeholder
  // In reality, you'd need to implement this on the backend
  return get<AdminTipsListItem>(`/admin/wallets/tips/${id}`);
};
export const createTokenTransfer = createTipsTransfer;

