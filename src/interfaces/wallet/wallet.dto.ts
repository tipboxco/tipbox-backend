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
  publicAddress: string;
  provider: 'METAMASK' | 'WALLETCONNECT' | 'CUSTOM';
  isConnected: boolean;
  shortAddress: string;
  providerIcon: string;
  createdAt: string;
  updatedAt: string;
}