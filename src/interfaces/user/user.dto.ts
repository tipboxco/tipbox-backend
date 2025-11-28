/**
 * @openapi
 * components:
 *   schemas:
 *     CreateUserRequest:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: user@tipbox.co
 *         displayName:
 *           type: string
 *           example: Ömer Faruk
 *           description: Kullanıcının görünen adı (Profile tablosunda saklanır)
 *         bio:
 *           type: string
 *           example: Tipbox topluluk üyesi
 *           description: Kullanıcı hakkında kısa bilgi
 *     CreateUserWithPasswordRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: user@tipbox.co
 *         password:
 *           type: string
 *           format: password
 *           example: SecurePassword123!
 *         displayName:
 *           type: string
 *           example: Ömer Faruk
 *         bio:
 *           type: string
 *           example: Tipbox topluluk üyesi
 *     UserResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "c01h2z5k7m9p3r6t8v0x2b4n6q"
 *         email:
 *           type: string
 *           format: email
 *           example: user@tipbox.co
 *         name:
 *           type: string
 *           example: Ömer Faruk
 *           description: DisplayName'den gelen değer (backward compatibility)
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, SUSPENDED, DELETED]
 *           example: ACTIVE
 *           description: Kullanıcı hesap durumu
 *         auth0Id:
 *           type: string
 *           nullable: true
 *           example: null
 *           description: Auth0 integration ID (şimdilik desteklenmiyor)
 *         walletAddress:
 *           type: string
 *           nullable: true
 *           example: null
 *           description: Kripto cüzdan adresi (ayrı tablo)
 *         kycStatus:
 *           type: string
 *           example: ""
 *           description: KYC durumu (ayrı tablo)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2025-08-01T10:00:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2025-08-01T10:00:00.000Z
 *     UpdateUserRequest:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: newemail@tipbox.co
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, SUSPENDED, DELETED]
 *           example: ACTIVE
 *         passwordHash:
 *           type: string
 *           description: Hashed password (internal use only)
 *     ProfileResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "01J9Y4NQSW3KZV9W0F7B6C2D1E"
 *         userId:
 *           type: string
 *           example: "01J9Y4NQSW3KZV9W0F7B6C2D1E"
 *         displayName:
 *           type: string
 *           nullable: true
 *           example: "Ömer Faruk"
 *         bio:
 *           type: string
 *           nullable: true
 *           example: "Tipbox topluluk üyesi"
 *         country:
 *           type: string
 *           nullable: true
 *           example: "Turkey"
 *         birthDate:
 *           type: string
 *           format: date
 *           nullable: true
 *           example: "1990-01-01"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2025-08-01T10:00:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2025-08-01T10:00:00.000Z
 *     UserFullResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/UserResponse'
 *         - type: object
 *           properties:
 *             profile:
 *               $ref: '#/components/schemas/ProfileResponse'
 *             wallets:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WalletResponse'
 *     UpdateUserProfileRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Profilde gösterilecek isim
 *         biography:
 *           type: string
 *           description: Kullanıcı biyografisi (max 500 karakter)
 *         banner:
 *           type: string
 *           nullable: true
 *           description: Banner görsel URL'si
 *         avatar:
 *           type: string
 *           nullable: true
 *           description: Avatar görsel URL'si (MinIO/S3)
 *         cosmetic:
 *           type: string
 *           nullable: true
 *           description: Aktif kozmetik badge/çerçeve ID'si
 *         badge:
 *           type: array
 *           items:
 *             type: string
 *           description: Aktif olarak seçilen badge ID listesi
 */
export interface CreateUserRequest {
  email: string;
  displayName?: string;
  bio?: string;
}

export interface CreateUserWithPasswordRequest {
  email: string;
  password: string;
  displayName?: string;
  bio?: string;
}

export interface UpdateUserRequest {
  email?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED';
  passwordHash?: string; // Internal use only
}

export interface UserResponse {
  id: string;
  email: string | null;
  name: string | null; // displayName için backward compatibility
  status: string | null;
  auth0Id: string | null;
  walletAddress: string | null;
  kycStatus: string;
  createdAt: string;
  updatedAt: string;
}

// Profile için ayrı DTO 
export interface ProfileResponse {
  id: string;
  userId: string;
  displayName: string | null;
  bio: string | null;
  country: string | null;
  birthDate: string | null; // ISO date string
  createdAt: string;
  updatedAt: string;
}

// Wallet DTO'ları artık src/interfaces/wallet/wallet.dto.ts'de

export interface UserWithProfileResponse extends UserResponse {
  profile?: ProfileResponse;
}

export interface UserWithWalletsResponse extends UserResponse {
  wallets: any[]; // Import from wallet.dto when needed
}

export interface UserFullResponse extends UserResponse {
  profile?: ProfileResponse;
  wallets: any[]; // Import from wallet.dto when needed
} 

export interface UpdateUserProfileRequest {
  name?: string;
  biography?: string;
  banner?: string | null;
  avatar?: string | null;
  cosmetic?: string | null;
  badge?: string[];
}