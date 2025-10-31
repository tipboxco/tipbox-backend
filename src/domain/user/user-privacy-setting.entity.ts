import { PrivacyCode } from './privacy-code.enum';

export class UserPrivacySetting {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly privacyCode: PrivacyCode,
    public readonly selectedValue: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  isValidValue(): boolean {
    const validValues = ['trust-only', 'everyone', 'friends', 'private', 'public'];
    return validValues.includes(this.selectedValue);
  }
}

