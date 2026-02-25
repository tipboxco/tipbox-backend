import {
  FlagOutlined,
  GiftOutlined,
  CreditCardOutlined,
  PictureOutlined,
  BgColorsOutlined,
  FilterOutlined,
  MessageOutlined,
  RobotOutlined,
  AppstoreAddOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

type MenuItem = Required<MenuProps>['items'][number];

/**
 * New Admin Modules Menu Configuration
 * Can be integrated into existing sidebar as a "General" or "New Modules" section
 */
export const newModulesMenu: MenuItem[] = [
  {
    key: 'new-modules',
    label: 'General',
    icon: <AppstoreAddOutlined />,
    children: [
      {
        key: '/moderation/user-reports',
        label: 'User Reports',
        icon: <FlagOutlined />,
      },
      {
        key: '/billing/subscription-plans',
        label: 'Subscription Plans',
        icon: <CreditCardOutlined />,
      },
      {
        key: '/marketing/marketplace-banners',
        label: 'Marketplace Banners',
        icon: <PictureOutlined />,
      },
      {
        key: '/system/user-themes',
        label: 'User Themes',
        icon: <BgColorsOutlined />,
      },
      {
        key: '/users/feed-preferences',
        label: 'Feed Preferences',
        icon: <FilterOutlined />,
      },
      {
        key: '/support/dm-sessions',
        label: 'DM Support Sessions',
        icon: <MessageOutlined />,
      },
      {
        key: '/analytics/ai-experience-splits',
        label: 'AI Experience Splits',
        icon: <RobotOutlined />,
      },
    ],
  },
];

/**
 * Alternative: Categorized menu structure
 * Organize by category instead of single "General" section
 */
export const categorizedModulesMenu: MenuItem[] = [
  {
    key: 'moderation',
    label: 'Moderation',
    icon: <FlagOutlined />,
    children: [
      {
        key: '/moderation/user-reports',
        label: 'User Reports',
        icon: <FlagOutlined />,
      },
    ],
  },
  {
    key: 'billing',
    label: 'Billing',
    icon: <CreditCardOutlined />,
    children: [
      {
        key: '/billing/subscription-plans',
        label: 'Subscription Plans',
        icon: <CreditCardOutlined />,
      },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: <PictureOutlined />,
    children: [
      {
        key: '/marketing/marketplace-banners',
        label: 'Banners',
        icon: <PictureOutlined />,
      },
    ],
  },
  {
    key: 'system-extended',
    label: 'System',
    icon: <BgColorsOutlined />,
    children: [
      {
        key: '/system/user-themes',
        label: 'User Themes',
        icon: <BgColorsOutlined />,
      },
    ],
  },
  {
    key: 'support',
    label: 'Support',
    icon: <MessageOutlined />,
    children: [
      {
        key: '/support/dm-sessions',
        label: 'DM Sessions',
        icon: <MessageOutlined />,
      },
      {
        key: '/users/feed-preferences',
        label: 'Feed Preferences',
        icon: <FilterOutlined />,
      },
    ],
  },
  {
    key: 'analytics-extended',
    label: 'Analytics',
    icon: <RobotOutlined />,
    children: [
      {
        key: '/analytics/ai-experience-splits',
        label: 'AI Experience Splits',
        icon: <RobotOutlined />,
      },
    ],
  },
];

export default newModulesMenu;
