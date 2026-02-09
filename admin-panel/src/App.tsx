import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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

// Product pages
import ProductCatalog from './pages/products/ProductCatalog';
import ProductCategories from './pages/products/ProductCategories';
import ProductGroups from './pages/products/ProductGroups';
import ProductSuggestions from './pages/products/ProductSuggestions';
import UserInventories from './pages/products/UserInventories';
import ProductComparisons from './pages/products/ProductComparisons';

// Brand pages
import BrandList from './pages/brands/BrandList';
import BridgeProgram from './pages/brands/BridgeProgram';
import BrandSurveys from './pages/brands/BrandSurveys';
import BrandLeaderboards from './pages/brands/BrandLeaderboards';
import BrandRewards from './pages/brands/BrandRewards';

// Gamification pages
import BadgeDetail from './pages/gamification/BadgeDetail';
import BadgeCollections from './pages/gamification/BadgeCollections';
import CreateCollectionPage from './pages/gamification/CreateCollectionPage';
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

// Crypto pages
import Wallets from './pages/crypto/Wallets';
import NFTs from './pages/crypto/NFTs';
import NFTMarketplace from './pages/crypto/NFTMarketplace';
import Lootboxes from './pages/crypto/Lootboxes';
import TokenTransfers from './pages/crypto/TokenTransfers';

// Communication pages
import Notifications from './pages/communication/Notifications';
import DirectMessages from './pages/communication/DirectMessages';
import SupportRequests from './pages/communication/SupportRequests';
import ExpertRequests from './pages/communication/ExpertRequests';

// System pages
import AdminLogs from './pages/system/AdminLogs';
import SystemSettings from './pages/system/SystemSettings';
import ModerationActions from './pages/system/ModerationActions';

/** Giriş yapmış kullanıcı /login'e gelirse ana sayfaya yönlendir */
function LoginRedirect() {
  const { isAuthenticated, isReady } = useAuth();
  if (!isReady) return null;
  return isAuthenticated ? <Navigate to="/" replace /> : <Login />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRedirect />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />

          {/* Users — statik yollar önce, users/:id en sonda */}
          <Route path="users" element={<UserList />} />
          <Route path="users/kyc" element={<UserKYC />} />
          <Route path="users/kyc/:userId" element={<UserKycDetail />} />
          <Route path="users/reports" element={<UserReports />} />
          <Route path="users/reports/:id" element={<UserReportDetail />} />
          <Route path="users/banned" element={<BannedUsers />} />
          <Route path="users/:id" element={<UserDetail />} />

          {/* Content — posts/:id before other content so :id matches */}
          <Route path="content/posts" element={<ContentPosts />} />
          <Route path="content/posts/:id" element={<ContentPostDetail />} />
          <Route path="content/comments" element={<ContentComments />} />
          <Route path="content/trending" element={<TrendingPosts />} />
          <Route path="content/feed-highlights" element={<FeedHighlights />} />
          <Route path="content/tags" element={<TagsCategories />} />

          {/* Products */}
          <Route path="products" element={<ProductCatalog />} />
          <Route path="products/categories" element={<ProductCategories />} />
          <Route path="products/groups" element={<ProductGroups />} />
          <Route path="products/suggestions" element={<ProductSuggestions />} />
          <Route path="products/inventories" element={<UserInventories />} />
          <Route path="products/comparisons" element={<ProductComparisons />} />

          {/* Brands */}
          <Route path="brands" element={<BrandList />} />
          <Route path="brands/bridge" element={<BridgeProgram />} />
          <Route path="brands/surveys" element={<BrandSurveys />} />
          <Route path="brands/leaderboards" element={<BrandLeaderboards />} />
          <Route path="brands/rewards" element={<BrandRewards />} />

          {/* Gamification */}
          <Route path="gamification/badges" element={<Navigate to="/gamification/event-badges" replace />} />
          <Route path="gamification/collections" element={<BadgeCollections />} />
          <Route path="gamification/collections/new" element={<CreateCollectionPage />} />
          <Route path="gamification/collections/:id/badges/:badgeId" element={<BadgeDetail />} />
          <Route path="gamification/collections/:id" element={<CollectionDetail />} />
          <Route path="gamification/event-badges" element={<EventBadgesList />} />
          <Route path="gamification/event-badges/:id" element={<BadgeDetail />} />
          <Route path="gamification/brand-badges" element={<BrandBadgesList />} />
          <Route path="gamification/brand-badges/:id" element={<BadgeDetail />} />
          <Route path="gamification/cosmetic-badges" element={<CosmeticBadgesList />} />
          <Route path="gamification/cosmetic-badges/:id" element={<BadgeDetail />} />
          <Route path="gamification/progress" element={<UserProgress />} />

          {/* Events — statik yollar önce, :id en sonda */}
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

          {/* Crypto */}
          <Route path="crypto/wallets" element={<Wallets />} />
          <Route path="crypto/nfts" element={<NFTs />} />
          <Route path="crypto/marketplace" element={<NFTMarketplace />} />
          <Route path="crypto/lootboxes" element={<Lootboxes />} />
          <Route path="crypto/transfers" element={<TokenTransfers />} />

          {/* Communication */}
          <Route path="communication/notifications" element={<Notifications />} />
          <Route path="communication/messages" element={<DirectMessages />} />
          <Route path="communication/support" element={<SupportRequests />} />
          <Route path="communication/experts" element={<ExpertRequests />} />

          {/* Analytics */}
          <Route path="analytics" element={<Analytics />} />

          {/* System */}
          <Route path="system/logs" element={<AdminLogs />} />
          <Route path="system/settings" element={<SystemSettings />} />
          <Route path="system/moderation" element={<ModerationActions />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
