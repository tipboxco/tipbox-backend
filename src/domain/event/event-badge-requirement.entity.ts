import { EventBadgeRequirementType } from './event-badge-requirement-type.enum';

export interface EventBadgeRequirement {
  badgeId: string;
  type: EventBadgeRequirementType;
  threshold: number; // Örn: 1 post, 10 beğeni (alınan)
}
