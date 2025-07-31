export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export class User {
  constructor(
    public readonly id: number,
    public readonly email: string | null,
    public readonly name: string | null,
    public readonly auth0Id: string | null,
    public readonly walletAddress: string | null,
    public readonly kycStatus: import('./kyc-status.enum').KycStatus,
    public readonly role: UserRole,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}
} 