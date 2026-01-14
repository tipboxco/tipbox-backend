export interface MarketplaceNFTResponse {
  id: string;
  title: string;
  username: string;
  price: string;
  image: string;
  userAvatar?: string;
}

export interface UserNFTResponse {
  id: string;
  title: string;
  username: string;
  image: string;
  description?: string;
  type: string;
  rarity: string;
  listing?: {
    id: string;
    price: number;
    listedAt: string;
    status: 'ACTIVE' | 'SOLD' | 'CANCELLED';
  };
}

export interface ListMarketplaceNFTsQuery {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  type?: 'BADGE' | 'COSMETIC' | 'LOOTBOX';
  rarity?: 'COMMON' | 'RARE' | 'EPIC';
  limit?: number;
  cursor?: string;
  orderBy?: 'price_asc' | 'price_desc' | 'listedAt_desc' | 'listedAt_asc';
}

export interface ListUserNFTsQuery {
  limit?: number;
  cursor?: string;
}

export interface CreateListingRequest {
  nftId: string;
  amount: number; // TIPS miktarı
}

export interface UpdateListingPriceRequest {
  amount: number; // Yeni TIPS miktarı
}

export interface MarketplaceNFTDetailResponse extends MarketplaceNFTResponse {
  description?: string;
  rarity: string;
  type: string;
  listedAt: string;
  sellerId: string;
  nftId: string;
}

export type RarityType = 'usual' | 'rare' | 'epic' | 'legendary';

export interface SellNFT {
  id: string;
  title: string;
  description?: string;
  image: string;
  type: string;
  viewer: number;
  rarity: RarityType;
  price: number; // TIPS
  suggestedPrice: number; // TIPS
  gasFee: number;
  earningsAfterSales: number;
}

export interface SellNFTDetail {
  id: string;
  title: string;
  description?: string;
  image: string;
  type: string;
  viewer: number;
  rarity: RarityType;
  price: number; // TIPS
  suggestedPrice: number; // TIPS
  earnDate: string;
  totalOwner: number;
  ownerUser: {
    id: string;
    name: string;
  };
  priceHistory: NFTPriceHistory[];
}

export interface NFTPriceHistory {
  id: string;
  price: number; // TIPS
  listedAt: string; // ISO date
  status: 'ACTIVE' | 'SOLD' | 'CANCELLED';
  seller: {
    id: string;
    name: string;
  };
}

// Keep salesHistory for backward compatibility (deprecated)
export interface NFTSaleHistory {
  id: string;
  price: number; // TIPS
  soldAt: string; // ISO date
  seller: {
    id: string;
    name: string;
  };
  buyer: {
    id: string;
    name: string;
  };
}

export interface BuyNFTRequest {
  listingId: string;
}

export interface BuyNFTResponse {
  success: boolean;
  nftId: string;
  buyerTransaction: {
    id: string;
    amount: number | null;
    status: string;
  };
  sellerTransaction: {
    id: string;
    amount: number | null;
    status: string;
  };
  newOwner: {
    id: string;
    name: string;
  };
}

