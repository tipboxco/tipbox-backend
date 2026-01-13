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
  viewer: number;
  rarity: RarityType;
  price: number; // TIPS
  suggestedPrice: number; // TIPS
  gasFee: number;
  earningsAfterSales: number;
}

export interface SellNFTDetail {
  id: string;
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
}

