import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { darkTheme, lightTheme } from './theme/antd-theme';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';

// User pages
import UserList from './pages/users/UserList';
import UserDetail from './pages/users/UserDetail';
import UserKYC from './pages/users/UserKYC';
import UserReports from './pages/users/UserReports';
import UserReportDetail from './pages/users/UserReportDetail';
import UserKycDetail from './pages/users/UserKycDetail';
import BannedUsers from './pages/users/BannedUsers';

// Content pages
import ContentPosts from './pages/content/ContentPosts';
import ContentPostDetail from './pages/content/ContentPostDetail';
import ContentComments from './pages/content/ContentComments';
import TrendingPosts from './pages/content/TrendingPosts';
import TagsCategories from './pages/content/TagsCategories';
import FeedHighlights from './pages/content/FeedHighlights';
import BoostOptions from './pages/content/BoostOptions';
import ContentCollections from './pages/content/ContentCollections';
import TopCommunityChoices from './pages/content/TopCommunityChoices';
import ManualReviewFlags from './pages/content/ManualReviewFlags';

// Product pages
import ProductCatalog from './pages/products/ProductCatalog';
import ProductDetail from './pages/products/ProductDetail';
import ProductCategories from './pages/products/ProductCategories';
import ProductGroups from './pages/products/ProductGroups';
import ProductSuggestions from './pages/products/ProductSuggestions';
import UserInventories from './pages/products/UserInventories';
import ProductComparisons from './pages/products/ProductComparisons';
import CategoryManagement from './pages/products/CategoryManagement';
import ComparisonMetrics from './pages/products/ComparisonMetrics';

// Brand pages
import BrandList from './pages/brands/BrandList';
import BridgeProgram from './pages/brands/BridgeProgram';
import BrandSurveys from './pages/brands/BrandSurveys';
import BrandLeaderboards from './pages/brands/BrandLeaderboards';
import BrandRewards from './pages/brands/BrandRewards';
import BrandCategories from './pages/brands/BrandCategories';

// News pages
import NewsList from './pages/news/NewsList';
import NewsDetail from './pages/news/NewsDetail';

// Gamification pages
import BadgeDetail from './pages/gamification/BadgeDetail';
import BadgeCollections from './pages/gamification/BadgeCollections';
import CollectionDetail from './pages/gamification/CollectionDetail';
import EventBadgesList from './pages/gamification/EventBadgesList';
import BrandBadgesList from './pages/gamification/BrandBadgesList';
import CosmeticBadgesList from './pages/gamification/CosmeticBadgesList';
import UserProgress from './pages/gamification/UserProgress';

// Event pages
import EventList from './pages/events/EventList';
import EventDetail from './pages/events/EventDetail';
import EventBadges from './pages/events/EventBadges';
import EventRewards from './pages/events/EventRewards';
import EventAnalytics from './pages/events/EventAnalytics';

// Commerce pages
import Transactions from './pages/commerce/Transactions';
import Rewards from './pages/commerce/Rewards';
import Subscriptions from './pages/commerce/Subscriptions';
import Invoices from './pages/commerce/Invoices';
import RewardClaims from './pages/commerce/RewardClaims';

// Crypto pages
import Wallets from './pages/crypto/Wallets';
import NFTs from './pages/crypto/NFTs';
import NFTMarketplace from './pages/crypto/NFTMarketplace';
import TokenTransfers from './pages/crypto/TokenTransfers';
import TipsManagement from './pages/crypto/TipsManagement';

// Communication pages
import Notifications from './pages/communication/Notifications';
import DirectMessages from './pages/communication/DirectMessages';
import DMModeration from './pages/communication/DMModeration';
import SupportRequests from './pages/communication/SupportRequests';
import ExpertRequests from './pages/communication/ExpertRequests';

// Moderation pages
import ModerationUserReports from './pages/moderation/UserReports';
import ModerationUserReportDetail from './pages/moderation/UserReportDetail';

// Billing pages
import SubscriptionPlans from './pages/billing/SubscriptionPlans';

// Support pages
import DMSupportSessions from './pages/support/DMSupportSessions';

// Marketing pages
import MarketplaceBanners from './pages/marketing/MarketplaceBanners';

// Analytics pages (additional)
import AiExperienceSplits from './pages/analytics/AiExperienceSplits';

// User pages (additional)
import UserFeedPreferences from './pages/users/UserFeedPreferences';

// System pages
import AdminLogs from './pages/system/AdminLogs';
import SystemSettings from './pages/system/SystemSettings';
import ModerationActions from './pages/system/ModerationActions';
import ExperienceConfig from './pages/system/ExperienceConfig';
import UserThemes from './pages/system/UserThemes';

/** Redirect logged-in user to home if they visit /login */
function LoginRedirect() {
  const { isAuthenticated, isReady } = useAuth();
  if (!isReady) return null;
  return isAuthenticated ? <Navigate to="/" replace /> : <Login />;
}

/** Ant Design ConfigProvider wrapper - uses theme from ThemeContext */
function ThemedApp({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  const antdConfig = theme === 'dark' ? darkTheme : lightTheme;
  const algorithm = theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;

  return (
    <ConfigProvider
      theme={{
        ...antdConfig,
        algorithm,
      }}
    >
      {children}
    </ConfigProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ThemedApp>
        <Router basename={import.meta.env.VITE_BASE_PATH || '/'}>
          <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginRedirect />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />

          {/* Users — static routes first, users/:id last */}
          <Route path="users" element={<UserList />} />
          <Route path="users/kyc" element={<UserKYC />} />
          <Route path="users/kyc/:userId" element={<UserKycDetail />} />
          <Route path="users/reports" element={<UserReports />} />
          <Route path="users/reports/:id" element={<UserReportDetail />} />
          <Route path="users/banned" element={<BannedUsers />} />
          <Route path="users/feed-preferences" element={<UserFeedPreferences />} />
          <Route path="users/:id" element={<UserDetail />} />

          {/* Content — posts/:id before other content so :id matches */}
          <Route path="content/posts" element={<ContentPosts />} />
          <Route path="content/posts/:id" element={<ContentPostDetail />} />
          <Route path="content/comments" element={<ContentComments />} />
          <Route path="content/trending" element={<TrendingPosts />} />
          <Route path="content/feed-highlights" element={<FeedHighlights />} />
          <Route path="content/tags" element={<TagsCategories />} />
          <Route path="content/boost-options" element={<BoostOptions />} />
          <Route path="content/collections" element={<ContentCollections />} />
          <Route path="content/top-community-choices" element={<TopCommunityChoices />} />
          <Route path="content/manual-review-flags" element={<ManualReviewFlags />} />

          {/* Products - static routes first, :id last */}
          <Route path="products" element={<ProductCatalog />} />
          <Route path="products/categories" element={<ProductCategories />} />
          <Route path="products/groups" element={<ProductGroups />} />
          <Route path="products/suggestions" element={<ProductSuggestions />} />
          <Route path="products/inventories" element={<UserInventories />} />
          <Route path="products/comparisons" element={<ProductComparisons />} />
          <Route path="products/category-management" element={<CategoryManagement />} />
          <Route path="products/comparison-metrics" element={<ComparisonMetrics />} />
          <Route path="products/:id" element={<ProductDetail />} />

          {/* Brands */}
          <Route path="brands" element={<BrandList />} />
          <Route path="brands/bridge" element={<BridgeProgram />} />
          <Route path="brands/surveys" element={<BrandSurveys />} />
          <Route path="brands/leaderboards" element={<BrandLeaderboards />} />
          <Route path="brands/rewards" element={<BrandRewards />} />
          <Route path="brands/categories" element={<BrandCategories />} />

          {/* News */}
          <Route path="news" element={<NewsList />} />
          <Route path="news/:id" element={<NewsDetail />} />

          {/* Gamification */}
          <Route path="gamification/badges" element={<Navigate to="/gamification/event-badges" replace />} />
          <Route path="gamification/collections" element={<BadgeCollections />} />
          <Route path="gamification/collections/:id/badges/:badgeId" element={<BadgeDetail />} />
          <Route path="gamification/collections/:id" element={<CollectionDetail />} />
          <Route path="gamification/event-badges" element={<EventBadgesList />} />
          <Route path="gamification/event-badges/:id" element={<BadgeDetail />} />
          <Route path="gamification/brand-badges" element={<BrandBadgesList />} />
          <Route path="gamification/brand-badges/:id" element={<BadgeDetail />} />
          <Route path="gamification/cosmetic-badges" element={<CosmeticBadgesList />} />
          <Route path="gamification/cosmetic-badges/:id" element={<BadgeDetail />} />
          <Route path="gamification/progress" element={<UserProgress />} />

          {/* Events — static routes first, :id last */}
          <Route path="events" element={<EventList />} />
          <Route path="events/badges" element={<EventBadges />} />
          <Route path="events/rewards" element={<EventRewards />} />
          <Route path="events/analytics" element={<EventAnalytics />} />
          <Route path="events/:id" element={<EventDetail />} />

          {/* Commerce */}
          <Route path="commerce/transactions" element={<Transactions />} />
          <Route path="commerce/rewards" element={<Rewards />} />
          <Route path="commerce/subscriptions" element={<Subscriptions />} />
          <Route path="commerce/invoices" element={<Invoices />} />
          <Route path="commerce/reward-claims" element={<RewardClaims />} />

          {/* Crypto */}
          <Route path="crypto/wallets" element={<Wallets />} />
          <Route path="crypto/nfts" element={<NFTs />} />
          <Route path="crypto/marketplace" element={<NFTMarketplace />} />
          <Route path="crypto/transfers" element={<TokenTransfers />} />
          <Route path="crypto/tips" element={<TipsManagement />} />

          {/* Communication */}
          <Route path="communication/notifications" element={<Notifications />} />
          <Route path="communication/messages" element={<DirectMessages />} />
          <Route path="communication/moderation" element={<DMModeration />} />
          <Route path="communication/support" element={<SupportRequests />} />
          <Route path="communication/experts" element={<ExpertRequests />} />

          {/* Analytics */}
          <Route path="analytics" element={<Analytics />} />
          <Route path="analytics/ai-experience-splits" element={<AiExperienceSplits />} />

          {/* Moderation */}
          <Route path="moderation/user-reports" element={<ModerationUserReports />} />
          <Route path="moderation/user-reports/:id" element={<ModerationUserReportDetail />} />

          {/* Billing */}
          <Route path="billing/subscription-plans" element={<SubscriptionPlans />} />

          {/* Support */}
          <Route path="support/dm-sessions" element={<DMSupportSessions />} />

          {/* Marketing */}
          <Route path="marketing/marketplace-banners" element={<MarketplaceBanners />} />

          {/* System */}
          <Route path="system/logs" element={<AdminLogs />} />
          <Route path="system/settings" element={<SystemSettings />} />
          <Route path="system/moderation" element={<ModerationActions />} />
          <Route path="system/experience-config" element={<ExperienceConfig />} />
          <Route path="system/user-themes" element={<UserThemes />} />
          </Route>
        </Routes>
        </AuthProvider>
        </Router>
      </ThemedApp>
    </ThemeProvider>
  );
}

export default App;
