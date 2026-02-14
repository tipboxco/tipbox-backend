import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

// Lazy load all new module components
const UserReports = lazy(() => import('../pages/moderation/UserReports'));
const UserReportDetail = lazy(() => import('../pages/moderation/UserReportDetail'));
const Lootboxes = lazy(() => import('../pages/gamification/Lootboxes'));
const SubscriptionPlans = lazy(() => import('../pages/billing/SubscriptionPlans'));
const MarketplaceBanners = lazy(() => import('../pages/marketing/MarketplaceBanners'));
const UserThemes = lazy(() => import('../pages/system/UserThemes'));
const UserFeedPreferences = lazy(() => import('../pages/users/UserFeedPreferences'));
const DMSupportSessions = lazy(() => import('../pages/support/DMSupportSessions'));
const AiExperienceSplits = lazy(() => import('../pages/analytics/AiExperienceSplits'));

/**
 * New Admin Module Routes
 * 8 new modules with comprehensive CRUD capabilities
 */
export const newModuleRoutes: RouteObject[] = [
  // Moderation
  {
    path: 'moderation/user-reports',
    element: <UserReports />,
  },
  {
    path: 'moderation/user-reports/:id',
    element: <UserReportDetail />,
  },

  // Gamification
  {
    path: 'gamification/lootboxes',
    element: <Lootboxes />,
  },

  // Billing
  {
    path: 'billing/subscription-plans',
    element: <SubscriptionPlans />,
  },

  // Marketing
  {
    path: 'marketing/marketplace-banners',
    element: <MarketplaceBanners />,
  },

  // System
  {
    path: 'system/user-themes',
    element: <UserThemes />,
  },

  // Users
  {
    path: 'users/feed-preferences',
    element: <UserFeedPreferences />,
  },

  // Support
  {
    path: 'support/dm-sessions',
    element: <DMSupportSessions />,
  },

  // Analytics
  {
    path: 'analytics/ai-experience-splits',
    element: <AiExperienceSplits />,
  },
];

export default newModuleRoutes;
