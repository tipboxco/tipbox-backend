import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Avatar, Dropdown, Space, Divider } from 'antd';
import type { MenuProps } from 'antd';
import {
  LineChartOutlined,
  UserOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  ShopOutlined,
  TrophyOutlined,
  CalendarOutlined,
  CreditCardOutlined,
  WalletOutlined,
  MessageOutlined,
  PieChartOutlined,
  SettingOutlined,
  BulbOutlined,
  BulbFilled,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const { Sider } = Layout;

interface MenuItem {
  key: string;
  icon?: React.ReactNode;
  label: string;
  path?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    key: 'dashboard',
    icon: <LineChartOutlined />,
    label: 'Dashboard',
    path: '/',
  },
  {
    key: 'users',
    icon: <UserOutlined />,
    label: 'Users',
    children: [
      { key: 'users-list', label: 'User List', path: '/users' },
      { key: 'users-kyc', label: 'KYC Verification', path: '/users/kyc' },
      { key: 'users-reports', label: 'User Reports', path: '/users/reports' },
      { key: 'users-banned', label: 'Banned Users', path: '/users/banned' },
    ],
  },
  {
    key: 'content',
    icon: <FileTextOutlined />,
    label: 'Content',
    children: [
      { key: 'content-posts', label: 'All Posts', path: '/content/posts' },
      { key: 'content-comments', label: 'Comments', path: '/content/comments' },
      { key: 'content-trending', label: 'Trending Posts', path: '/content/trending' },
      { key: 'content-highlights', label: 'Feed Highlights', path: '/content/feed-highlights' },
      { key: 'content-tags', label: 'Tags & Categories', path: '/content/tags' },
    ],
  },
  {
    key: 'products',
    icon: <ShoppingOutlined />,
    label: 'Products',
    children: [
      { key: 'products-catalog', label: 'Product Catalog', path: '/products' },
      { key: 'products-categories', label: 'Categories', path: '/products/categories' },
      { key: 'products-groups', label: 'Product Groups', path: '/products/groups' },
      { key: 'products-suggestions', label: 'Product Suggestions', path: '/products/suggestions' },
      { key: 'products-inventories', label: 'User Inventories', path: '/products/inventories' },
      { key: 'products-comparisons', label: 'Comparisons', path: '/products/comparisons' },
    ],
  },
  {
    key: 'brands',
    icon: <ShopOutlined />,
    label: 'Brands',
    children: [
      { key: 'brands-list', label: 'Brand List', path: '/brands' },
      { key: 'brands-bridge', label: 'Bridge Program', path: '/brands/bridge' },
      { key: 'brands-surveys', label: 'Brand Surveys', path: '/brands/surveys' },
      { key: 'brands-leaderboards', label: 'Leaderboards', path: '/brands/leaderboards' },
      { key: 'brands-rewards', label: 'Rewards', path: '/brands/rewards' },
    ],
  },
  {
    key: 'gamification',
    icon: <TrophyOutlined />,
    label: 'Gamification',
    children: [
      { key: 'gamification-collections', label: 'Collections', path: '/gamification/collections' },
      { key: 'gamification-event-badges', label: 'Event Badges', path: '/gamification/event-badges' },
      { key: 'gamification-brand-badges', label: 'Brand Badges', path: '/gamification/brand-badges' },
      { key: 'gamification-cosmetic-badges', label: 'Cosmetic Badges', path: '/gamification/cosmetic-badges' },
      { key: 'gamification-progress', label: 'User Progress', path: '/gamification/progress' },
    ],
  },
  {
    key: 'events',
    icon: <CalendarOutlined />,
    label: 'Events',
    children: [
      { key: 'events-list', label: 'Event List', path: '/events' },
      { key: 'events-badges', label: 'Event Badges', path: '/events/badges' },
      { key: 'events-rewards', label: 'Event Rewards', path: '/events/rewards' },
      { key: 'events-analytics', label: 'Event Analytics', path: '/events/analytics' },
    ],
  },
  {
    key: 'commerce',
    icon: <CreditCardOutlined />,
    label: 'Commerce',
    children: [
      { key: 'commerce-transactions', label: 'Transactions', path: '/commerce/transactions' },
      { key: 'commerce-rewards', label: 'Rewards', path: '/commerce/rewards' },
      { key: 'commerce-subscriptions', label: 'Subscriptions', path: '/commerce/subscriptions' },
      { key: 'commerce-invoices', label: 'Invoices', path: '/commerce/invoices' },
    ],
  },
  {
    key: 'crypto',
    icon: <WalletOutlined />,
    label: 'Crypto',
    children: [
      { key: 'crypto-wallets', label: 'Wallets', path: '/crypto/wallets' },
      { key: 'crypto-nfts', label: 'NFTs', path: '/crypto/nfts' },
      { key: 'crypto-marketplace', label: 'NFT Marketplace', path: '/crypto/marketplace' },
      { key: 'crypto-lootboxes', label: 'Lootboxes', path: '/crypto/lootboxes' },
      { key: 'crypto-transfers', label: 'Token Transfers', path: '/crypto/transfers' },
    ],
  },
  {
    key: 'communication',
    icon: <MessageOutlined />,
    label: 'Communication',
    children: [
      { key: 'communication-notifications', label: 'Notifications', path: '/communication/notifications' },
      { key: 'communication-messages', label: 'Direct Messages', path: '/communication/messages' },
      { key: 'communication-support', label: 'Support Requests', path: '/communication/support' },
      { key: 'communication-experts', label: 'Expert Requests', path: '/communication/experts' },
    ],
  },
  {
    key: 'analytics',
    icon: <PieChartOutlined />,
    label: 'Analytics',
    path: '/analytics',
  },
  {
    key: 'system',
    icon: <SettingOutlined />,
    label: 'System',
    children: [
      { key: 'system-logs', label: 'Admin Logs', path: '/system/logs' },
      { key: 'system-settings', label: 'Settings', path: '/system/settings' },
      { key: 'system-moderation', label: 'Moderation Actions', path: '/system/moderation' },
    ],
  },
];

// Build path-to-key map for finding active menu item
const buildPathMap = (items: MenuItem[], map: Map<string, string> = new Map()): Map<string, string> => {
  items.forEach((item) => {
    if (item.path) {
      map.set(item.path, item.key);
    }
    if (item.children) {
      buildPathMap(item.children, map);
    }
  });
  return map;
};

// Convert menu items to Ant Design Menu format
const convertToAntdMenu = (items: MenuItem[]): MenuProps['items'] => {
  return items.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
    children: item.children ? convertToAntdMenu(item.children) : undefined,
  }));
};

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Build path map and find active menu item
  const pathMap = useMemo(() => buildPathMap(menuItems), []);

  const selectedKey = useMemo(() => {
    // Try exact match first
    const exactMatch = pathMap.get(location.pathname);
    if (exactMatch) return exactMatch;

    // Try partial match for dynamic routes (e.g., /users/123)
    for (const [path, key] of pathMap.entries()) {
      if (location.pathname.startsWith(path) && path !== '/') {
        return key;
      }
    }

    return 'dashboard';
  }, [location.pathname, pathMap]);

  // Find open keys (parent menu items)
  const openKeys = useMemo(() => {
    const keys: string[] = [];
    menuItems.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some((child) => child.key === selectedKey);
        if (hasActiveChild) {
          keys.push(item.key);
        }
      }
    });
    return keys;
  }, [selectedKey]);

  const [openMenus, setOpenMenus] = useState<string[]>(openKeys);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    // Find the menu item by key
    const findPath = (items: MenuItem[]): string | null => {
      for (const item of items) {
        if (item.key === key && item.path) {
          return item.path;
        }
        if (item.children) {
          const childPath = findPath(item.children);
          if (childPath) return childPath;
        }
      }
      return null;
    };

    const path = findPath(menuItems);
    if (path) {
      navigate(path);
    }
  };

  const handleOpenChange = (keys: string[]) => {
    // Accordion behavior: only one parent menu open at a time
    // If opening a new menu, keep only the latest one
    if (keys.length > openMenus.length) {
      // User is opening a new menu, keep only the new one
      const latestKey = keys.find((key) => !openMenus.includes(key));
      setOpenMenus(latestKey ? [latestKey] : keys);
    } else {
      // User is closing a menu, update normally
      setOpenMenus(keys);
    }
  };

  // User dropdown menu
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'theme',
      icon: theme === 'dark' ? <BulbOutlined /> : <BulbFilled />,
      label: theme === 'dark' ? 'Light Theme' : 'Dark Theme',
      onClick: toggleTheme,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      onClick: logout,
      danger: true,
    },
  ];

  const antdMenuItems = useMemo(() => convertToAntdMenu(menuItems), []);

  const isDark = theme === 'dark';
  const footerBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : '#f0f0f0';
  const userTextColor = isDark ? '#ffffff' : 'rgba(0, 0, 0, 0.88)';
  const userEmailColor = isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.65)';

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      trigger={null}
      width={260}
      style={{
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
      {/* Single flex container: logo + scrollable menu + fixed footer */}
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {/* Logo + collapse toggle - fixed top */}
        <div
          style={{
            height: 64,
            minHeight: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? 0 : '0 12px 0 24px',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
        >
          {collapsed ? (
            <img
              src="/tipbox-amblem-yellow.png"
              alt="Tipbox"
              style={{ height: 40, width: 40, display: 'block', objectFit: 'contain' }}
            />
          ) : (
            <img
              src="https://tipbox.co/images/tipbox-logo-yellow.png"
              alt="Tipbox"
              style={{ height: 32, width: 'auto', display: 'block' }}
            />
          )}
          {!collapsed && (
            <Button
              type="text"
              icon={<MenuFoldOutlined />}
              onClick={() => setCollapsed(true)}
              style={{ color: isDark ? 'rgba(255,255,255,0.65)' : undefined, flexShrink: 0 }}
            />
          )}
        </div>
        {collapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0', flexShrink: 0 }}>
            <Button
              type="text"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setCollapsed(false)}
              style={{ color: isDark ? 'rgba(255,255,255,0.65)' : undefined }}
            />
          </div>
        )}

        <Divider style={{ margin: '0 0 12px 0', flexShrink: 0 }} />

        {/* Navigation Menu - only this area scrolls */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            openKeys={collapsed ? [] : openMenus}
            onOpenChange={handleOpenChange}
            onClick={handleMenuClick}
            items={antdMenuItems}
            style={{ border: 'none', paddingBottom: 8 }}
          />
        </div>

        {/* Footer: User + Collapse - always fixed at bottom */}
        <div
          style={{
            flexShrink: 0,
            borderTop: `1px solid ${footerBorder}`,
            paddingTop: 12,
            background: 'inherit',
          }}
        >
          {user && (
            <div
              style={{
                padding: collapsed ? '12px 0' : '12px 16px',
                display: 'flex',
                justifyContent: collapsed ? 'center' : 'flex-start',
                alignItems: 'center',
              }}
            >
              <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="topRight">
                <Space style={{ cursor: 'pointer' }} size={12}>
                  <Avatar icon={<UserOutlined />} size={40} />
                  {!collapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.4, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: userTextColor,
                        }}
                      >
                        {user.fullName || 'Admin'}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: userEmailColor,
                        }}
                      >
                        {user.email}
                      </span>
                    </div>
                  )}
                </Space>
              </Dropdown>
            </div>
          )}
        </div>
      </div>
    </Sider>
  );
}

export default Sidebar;
