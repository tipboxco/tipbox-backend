/**
 * @openapi
 * components:
 *   schemas:
 *     CreateUserRequest:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           example: user@example.com
 *         name:
 *           type: string
 *           example: Omer Faruk
 *     UserResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         email:
 *           type: string
 *           example: user@example.com
 *         name:
 *           type: string
 *           example: Omer Faruk
 *         auth0Id:
 *           type: string
 *           example: auth0|123456789
 *         walletAddress:
 *           type: string
 *           example: 0x123456789abcdef
 *         kycStatus:
 *           type: string
 *           example: PENDING
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2024-06-01T12:00:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2024-06-01T12:00:00.000Z
 */
export interface CreateUserRequest {
  email: string | null;
  name?: string | null;
}

export interface UserResponse {
  id: number;
  email: string | null;
  name: string | null;
  auth0Id: string | null;
  walletAddress: string | null;
  kycStatus: string;
  createdAt: string;
  updatedAt: string;
} 