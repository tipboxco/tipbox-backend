import { BadgeRarity } from '../domain/gamification/badge-rarity.enum';
import { EventBadgeRequirementType } from '../domain/event/event-badge-requirement-type.enum';

export interface EventBadgeConfig {
  key: string;
  name: string;
  description: string;
  rarity: BadgeRarity;
  requirement: {
    type: EventBadgeRequirementType;
    threshold: number;
  };
}

export const EVENT_BADGE_CONFIGS: EventBadgeConfig[] = [
  {
    key: 'ACTIVE_POSTER',
    name: '[Event] Aktif Paylaşımcı',
    description: 'Event süresince 1 post paylaşan kullanıcılara verilen rozet',
    rarity: BadgeRarity.COMMON,
    requirement: {
      type: EventBadgeRequirementType.POSTS_COUNT,
      threshold: 1,
    },
  },
  {
    key: 'SUPER_POSTER',
    name: '[Event] Süper Paylaşımcı',
    description: 'Event süresince 3 post paylaşan kullanıcılara verilen rozet',
    rarity: BadgeRarity.RARE,
    requirement: {
      type: EventBadgeRequirementType.POSTS_COUNT,
      threshold: 3,
    },
  },
  {
    key: 'POST_MASTER',
    name: '[Event] Post Ustası',
    description: 'Event süresince 5 post paylaşan kullanıcılara verilen rozet',
    rarity: BadgeRarity.EPIC,
    requirement: {
      type: EventBadgeRequirementType.POSTS_COUNT,
      threshold: 5,
    },
  },
  {
    key: 'POPULAR_CREATOR',
    name: '[Event] Popüler İçerik Üreticisi',
    description: 'Event süresince 3 beğeni alan kullanıcılara verilen rozet',
    rarity: BadgeRarity.COMMON,
    requirement: {
      type: EventBadgeRequirementType.LIKES_RECEIVED,
      threshold: 3,
    },
  },
  {
    key: 'HIGHLY_LIKED_CREATOR',
    name: '[Event] Çok Beğenilen İçerik Üreticisi',
    description: 'Event süresince 5 beğeni alan kullanıcılara verilen rozet',
    rarity: BadgeRarity.RARE,
    requirement: {
      type: EventBadgeRequirementType.LIKES_RECEIVED,
      threshold: 5,
    },
  },
  {
    key: 'VIRAL_CREATOR',
    name: '[Event] Viral İçerik Üreticisi',
    description: 'Event süresince 10 beğeni alan kullanıcılara verilen rozet',
    rarity: BadgeRarity.EPIC,
    requirement: {
      type: EventBadgeRequirementType.LIKES_RECEIVED,
      threshold: 10,
    },
  },
];
