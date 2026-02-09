import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

interface SubMenuItem {
  path: string;
  label: string;
}

interface MenuItem {
  path?: string;
  label: string;
  icon: string;
  subItems?: SubMenuItem[];
}

const menuItems: MenuItem[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: 'fa-chart-line'
  },
  {
    label: 'Users',
    icon: 'fa-users',
    subItems: [
      { path: '/users', label: 'User List' },
      { path: '/users/kyc', label: 'KYC Verification' },
      { path: '/users/reports', label: 'User Reports' },
      { path: '/users/banned', label: 'Banned Users' },
    ],
  },
  {
    label: 'Content',
    icon: 'fa-file-lines',
    subItems: [
      { path: '/content/posts', label: 'All Posts' },
      { path: '/content/comments', label: 'Comments' },
      { path: '/content/trending', label: 'Trending Posts' },
      { path: '/content/feed-highlights', label: 'Feed Highlights' },
      { path: '/content/tags', label: 'Tags & Categories' },
    ],
  },
  {
    label: 'Products',
    icon: 'fa-box',
    subItems: [
      { path: '/products', label: 'Product Catalog' },
      { path: '/products/categories', label: 'Categories' },
      { path: '/products/groups', label: 'Product Groups' },
      { path: '/products/suggestions', label: 'Product Suggestions' },
      { path: '/products/inventories', label: 'User Inventories' },
      { path: '/products/comparisons', label: 'Comparisons' },
    ],
  },
  {
    label: 'Brands',
    icon: 'fa-store',
    subItems: [
      { path: '/brands', label: 'Brand List' },
      { path: '/brands/bridge', label: 'Bridge Program' },
      { path: '/brands/surveys', label: 'Brand Surveys' },
      { path: '/brands/leaderboards', label: 'Leaderboards' },
      { path: '/brands/rewards', label: 'Rewards' },
    ],
  },
  {
    label: 'Gamification',
    icon: 'fa-trophy',
    subItems: [
      { path: '/gamification/collections', label: 'Collections' },
      { path: '/gamification/event-badges', label: 'Event Badges' },
      { path: '/gamification/brand-badges', label: 'Brand Badges' },
      { path: '/gamification/cosmetic-badges', label: 'Cosmetic Badges' },
      { path: '/gamification/progress', label: 'User Progress' },
    ],
  },
  {
    label: 'Events',
    icon: 'fa-calendar-check',
    subItems: [
      { path: '/events', label: 'Event List' },
      { path: '/events/badges', label: 'Event Badges' },
      { path: '/events/rewards', label: 'Event Rewards' },
      { path: '/events/analytics', label: 'Event Analytics' },
    ],
  },
  {
    label: 'Commerce',
    icon: 'fa-credit-card',
    subItems: [
      { path: '/commerce/transactions', label: 'Transactions' },
      { path: '/commerce/rewards', label: 'Rewards' },
      { path: '/commerce/subscriptions', label: 'Subscriptions' },
      { path: '/commerce/invoices', label: 'Invoices' },
    ],
  },
  {
    label: 'Crypto',
    icon: 'fa-wallet',
    subItems: [
      { path: '/crypto/wallets', label: 'Wallets' },
      { path: '/crypto/nfts', label: 'NFTs' },
      { path: '/crypto/marketplace', label: 'NFT Marketplace' },
      { path: '/crypto/lootboxes', label: 'Lootboxes' },
      { path: '/crypto/transfers', label: 'Token Transfers' },
    ],
  },
  {
    label: 'Communication',
    icon: 'fa-comments',
    subItems: [
      { path: '/communication/notifications', label: 'Notifications' },
      { path: '/communication/messages', label: 'Direct Messages' },
      { path: '/communication/support', label: 'Support Requests' },
      { path: '/communication/experts', label: 'Expert Requests' },
    ],
  },
  {
    path: '/analytics',
    label: 'Analytics',
    icon: 'fa-chart-pie',
  },
  {
    label: 'System',
    icon: 'fa-gear',
    subItems: [
      { path: '/system/logs', label: 'Admin Logs' },
      { path: '/system/settings', label: 'Settings' },
      { path: '/system/moderation', label: 'Moderation Actions' },
    ],
  },
];

function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const location = useLocation();
  const { user, logout } = useAuth();

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const isMenuExpanded = (label: string) => expandedMenus.includes(label);

  const isSubItemActive = (subItems?: SubMenuItem[]) => {
    if (!subItems) return false;
    return subItems.some((item) => location.pathname.startsWith(item.path));
  };

  return (
    <>
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <img
            src="https://tipbox.co/images/tipbox-logo-yellow.png"
            alt="Tipbox Admin"
            className="logo"
          />
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item, index) => (
            <div key={item.label} className="nav-group">
              {item.subItems ? (
                <>
                  <button
                    className={`nav-item nav-parent ${
                      isSubItemActive(item.subItems) ? 'active' : ''
                    }`}
                    onClick={() => !isCollapsed && toggleMenu(item.label)}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <i className={`fa-solid ${item.icon} nav-icon`}></i>
                    {!isCollapsed && (
                      <>
                        <span className="nav-label">{item.label}</span>
                        <i
                          className={`fa-solid fa-chevron-${
                            isMenuExpanded(item.label) ? 'down' : 'right'
                          } nav-arrow`}
                        ></i>
                      </>
                    )}
                  </button>
                  {!isCollapsed && isMenuExpanded(item.label) && (
                    <div className="nav-submenu">
                      {item.subItems.map((subItem) => (
                        <NavLink
                          key={subItem.path}
                          to={subItem.path}
                          className={({ isActive }) =>
                            `nav-subitem ${isActive ? 'active' : ''}`
                          }
                        >
                          <span className="nav-subitem-dot"></span>
                          <span className="nav-sublabel">{subItem.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <NavLink
                  to={item.path!}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'active' : ''}`
                  }
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <i className={`fa-solid ${item.icon} nav-icon`}></i>
                  {!isCollapsed && <span className="nav-label">{item.label}</span>}
                </NavLink>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!isCollapsed && user && (
            <div className="sidebar-user">
              <span className="sidebar-user-email">{user.email}</span>
              {user.fullName && (
                <span className="sidebar-user-name">{user.fullName}</span>
              )}
            </div>
          )}
          <button
            type="button"
            className="sidebar-logout"
            onClick={logout}
            title="Çıkış yap"
            aria-label="Çıkış yap"
          >
            <i className="fa-solid fa-right-from-bracket nav-icon"></i>
            {!isCollapsed && <span className="nav-label">Çıkış</span>}
          </button>
        </div>

        <button
          className="collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <i className={`fa-solid fa-angles-${isCollapsed ? 'right' : 'left'}`}></i>
        </button>
      </aside>

      {/* Mobile overlay */}
      <div className="sidebar-overlay" onClick={() => setIsCollapsed(false)}></div>
    </>
  );
}

export default Sidebar;
