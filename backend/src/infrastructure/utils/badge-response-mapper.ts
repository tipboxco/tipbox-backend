import { BadgeRarity } from '../../domain/gamification/badge-rarity.enum';
import { BadgeType } from '../../domain/gamification/badge-type.enum';
import { MainAction } from '../../domain/gamification/main-action.enum';

interface AchievementGoal {
  id: string;
  title: string;
  mainAction: string;
  pointsRequired: number;
}

interface UserAchievement {
  progress: number;
  completed: boolean;
}

export class BadgeResponseMapper {
  /**
   * Map database BadgeRarity enum to frontend format
   * DB: COMMON -> Frontend: Usual
   */
  static mapRarity(
    dbRarity: string | BadgeRarity,
  ): 'Usual' | 'Rare' | 'Epic' | 'Legendary' {
    const rarityStr = String(dbRarity);
    switch (rarityStr) {
      case 'COMMON':
        return 'Usual';
      case 'RARE':
        return 'Rare';
      case 'EPIC':
        return 'Epic';
      case 'LEGENDARY':
        return 'Legendary';
      default:
        return 'Usual';
    }
  }

  /**
   * Map database BadgeType to frontend categories
   * BRAND = bridge
   * COLLECTION + EVENT + COSMETIC = achievement
   */
  static mapBadgeCategory(dbType: string | BadgeType): 'achievement' | 'bridge' {
    const typeStr = String(dbType);
    return typeStr === 'BRAND' ? 'bridge' : 'achievement';
  }

  /**
   * Transform task progress from AchievementGoal + UserAchievement
   */
  static toTaskProgress(
    goal: AchievementGoal,
    userProgress?: UserAchievement,
  ) {
    return {
      id: goal.id,
      title: goal.title,
      type: this.mapActionType(goal.mainAction),
      current: userProgress?.progress ?? 0,
      total: goal.pointsRequired,
      isCompleted: userProgress?.completed ?? false,
    };
  }

  /**
   * Map MainAction enum to frontend task type
   */
  private static mapActionType(
    action: string | MainAction,
  ): 'Comment' | 'Like' | 'Share' {
    const actionStr = String(action);
    switch (actionStr) {
      case 'COMMENT':
        return 'Comment';
      case 'LIKE':
        return 'Like';
      case 'POST':
      case 'BOOKMARK':
      case 'JOIN':
      case 'SYSTEM':
      default:
        return 'Share';
    }
  }
}
