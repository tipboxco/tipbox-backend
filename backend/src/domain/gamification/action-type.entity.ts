import { MainAction } from './main-action.enum';

export class ActionType {
  constructor(
    public readonly id: string,
    public readonly mainAction: MainAction,
    public readonly code: string,
    public readonly label: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  getFullLabel(): string {
    return `${this.mainAction}: ${this.label}`;
  }

  matches(mainAction: MainAction, code: string): boolean {
    return this.mainAction === mainAction && this.code === code;
  }

  isPostAction(): boolean {
    return this.mainAction === MainAction.POST;
  }

  isSystemAction(): boolean {
    return this.mainAction === MainAction.SYSTEM;
  }
}
