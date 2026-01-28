/**
 * @openapi
 * components:
 *   schemas:
 *     WalletResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "01J9Y4NQSW3KZV9W0F7B6C2D1E"
 *         userId:
 *           type: string
 *           example: "01J9Y4NQSW3KZV9W0F7B6C2D1E"
 *         publicAddress:
 *           type: string
 *           example: 0x742d35Cc6632C0532c718cF7Bc9f1ba3d1c7F3EA
 *         provider:
 *           type: string
 *           enum: [METAMASK, WALLETCONNECT, CUSTOM]
 *           example: METAMASK
 *         isConnected:
 *           type: boolean
 *           example: true
 *         shortAddress:
 *           type: string
 *           example: 0x742d...F3EA
 *         providerIcon:
 *           type: string
 *           example: 🦊
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2025-08-01T10:00:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2025-08-01T10:00:00.000Z
 *     ConnectWalletRequest:
 *       type: object
 *       required:
 *         - publicAddress
 *         - provider
 *       properties:
 *         publicAddress:
 *           type: string
 *           example: 0x742d35Cc6632C0532c718cF7Bc9f1ba3d1c7F3EA
 *           description: Ethereum wallet address (0x + 40 hex characters)
 *         provider:
 *           type: string
 *           enum: [METAMASK, WALLETCONNECT, CUSTOM]
 *           example: METAMASK
 *           description: Wallet provider type
 */

export interface ConnectWalletRequest {
  publicAddress: string;
  provider: 'METAMASK' | 'WALLETCONNECT' | 'CUSTOM';
}

export interface WalletResponse {
  id: string;
  userId: string;
  /** EIP-7702 EOA wallet adresi */
  publicAddress: string;
  /** ERC-4337 Smart Account adresi (Account Abstraction) */
  smartAccountAddress?: string | null;
  provider: 'METAMASK' | 'WALLETCONNECT' | 'CUSTOM' | 'THIRDWEB';
  isConnected: boolean;
  balance?: number;
  lockedBalance?: number;
  shortAddress: string;
  shortSmartAccountAddress?: string | null;
  providerIcon: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     ThirdwebAuthenticateResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Authentication başarılı mı?
 *           example: true
 *         isNewUser:
 *           type: boolean
 *           description: Yeni kullanıcı mı (ilk kez wallet oluşturuldu mu)?
 *           example: false
 *         walletAddress:
 *           type: string
 *           description: Thirdweb embedded wallet adresi
 *           example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *         wallet:
 *           $ref: '#/components/schemas/WalletResponse'
 *         error:
 *           type: string
 *           description: Hata mesajı (başarısız ise)
 *           example: null
 */
export interface ThirdwebAuthenticateResponse {
  success: boolean;
  isNewUser?: boolean;
  /** EIP-7702 EOA wallet adresi */
  walletAddress?: string;
  /** ERC-4337 Smart Account adresi */
  smartAccountAddress?: string;
  wallet?: WalletResponse;
  error?: string;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     ThirdwebWalletInfoResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         userId:
 *           type: string
 *           description: Thirdweb user ID
 *         address:
 *           type: string
 *           description: Wallet adresi
 *         createdAt:
 *           type: string
 *           format: date-time
 *         profiles:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               id:
 *                 type: string
 *               type:
 *                 type: string
 *               name:
 *                 type: string
 */
export interface ThirdwebWalletInfoResponse {
  success: boolean;
  userId?: string;
  address?: string;
  createdAt?: string;
  profiles?: Array<{
    email?: string;
    id: string;
    type: string;
    name?: string;
  }>;
  error?: string;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     TokenBalanceResponse:
 *       type: object
 *       properties:
 *         contractAddress:
 *           type: string
 *           example: "0xdAC17F958D2ee523a2206206994597C13D831ec7"
 *         symbol:
 *           type: string
 *           example: "USDT"
 *         name:
 *           type: string
 *           example: "Tether USD"
 *         decimals:
 *           type: integer
 *           example: 6
 *         balance:
 *           type: string
 *           description: Raw balance (wei)
 *           example: "1000000000"
 *         balanceFormatted:
 *           type: string
 *           description: Human readable balance
 *           example: "1000.0"
 *         logoUrl:
 *           type: string
 *           nullable: true
 */
export interface TokenBalanceResponse {
  contractAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  logoUrl?: string;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     NftItemResponse:
 *       type: object
 *       properties:
 *         contractAddress:
 *           type: string
 *         tokenId:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         imageUrl:
 *           type: string
 *           nullable: true
 *         tokenType:
 *           type: string
 *           enum: [ERC721, ERC1155]
 *         balance:
 *           type: string
 *           nullable: true
 *           description: ERC1155 için token miktarı
 */
export interface NftItemResponse {
  contractAddress: string;
  tokenId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  tokenType: 'ERC721' | 'ERC1155';
  balance?: string;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     WalletBalancesResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         nativeBalance:
 *           type: object
 *           properties:
 *             symbol:
 *               type: string
 *             balance:
 *               type: string
 *             balanceFormatted:
 *               type: string
 *         tokens:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TokenBalanceResponse'
 */
export interface WalletBalancesResponse {
  success: boolean;
  nativeBalance?: {
    symbol: string;
    balance: string;
    balanceFormatted: string;
  };
  tokens?: TokenBalanceResponse[];
  error?: string;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     WalletNftsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         nfts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/NftItemResponse'
 *         totalCount:
 *           type: integer
 */
export interface WalletNftsResponse {
  success: boolean;
  nfts?: NftItemResponse[];
  totalCount?: number;
  error?: string;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     TransferTokenRequest:
 *       type: object
 *       required:
 *         - toAddress
 *         - tokenContractAddress
 *         - amount
 *       properties:
 *         toAddress:
 *           type: string
 *           description: Alıcı wallet adresi
 *         tokenContractAddress:
 *           type: string
 *           description: ERC20 token contract adresi
 *         amount:
 *           type: string
 *           description: Transfer edilecek miktar (formatted)
 *         chainId:
 *           type: integer
 *           description: Chain ID (varsayılan Polygon)
 */
export interface TransferTokenRequest {
  toAddress: string;
  tokenContractAddress: string;
  amount: string;
  chainId?: number;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     TransferNftRequest:
 *       type: object
 *       required:
 *         - toAddress
 *         - nftContractAddress
 *         - tokenId
 *       properties:
 *         toAddress:
 *           type: string
 *         nftContractAddress:
 *           type: string
 *         tokenId:
 *           type: string
 *         tokenType:
 *           type: string
 *           enum: [ERC721, ERC1155]
 *           default: ERC721
 *         amount:
 *           type: string
 *           description: ERC1155 için transfer miktarı
 *         chainId:
 *           type: integer
 */
export interface TransferNftRequest {
  toAddress: string;
  nftContractAddress: string;
  tokenId: string;
  tokenType?: 'ERC721' | 'ERC1155';
  amount?: string;
  chainId?: number;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     TransferResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         transactionHash:
 *           type: string
 *           nullable: true
 *         error:
 *           type: string
 *           nullable: true
 */
export interface TransferResponse {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     ChainConfigResponse:
 *       type: object
 *       properties:
 *         chainId:
 *           type: integer
 *         name:
 *           type: string
 *         nativeCurrency:
 *           type: object
 *           properties:
 *             symbol:
 *               type: string
 *             decimals:
 *               type: integer
 *         blockExplorerUrl:
 *           type: string
 */
export interface ChainConfigResponse {
  chainId: number;
  name: string;
  nativeCurrency: {
    symbol: string;
    decimals: number;
  };
  blockExplorerUrl?: string;
}