import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, Spin, Alert, Typography, Space, Button, Tag, Progress, Table, Divider } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  CalendarOutlined,
  FlagOutlined,
  ShopOutlined,
  WalletOutlined,
  TrophyOutlined,
  ArrowRightOutlined,
  StopOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  MinusCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  LineOutlined,
  PictureOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { fetchAdminStats } from '../api/admin-stats';
import {
  fetchUserGrowthAnalytics,
  fetchContentTrends,
  fetchEngagementAnalytics,
  fetchRevenueAnalyticsData,
  fetchPlatformHealth,
  fetchEventStats,
  fetchNftStats,
  fetchBadgeStats,
  fetchCollectionStats,
  fetchProductStats,
  fetchBrandStats,
  fetchWalletStats,
  fetchUserReportStats,
  fetchSubscriptionPlanStats,
  type UserGrowthAnalytics,
  type ContentTrendsAnalytics,
  type EngagementAnalytics,
  type RevenueAnalytics,
  type PlatformHealthAnalytics,
  type EventStats,
  type NftStats,
  type BadgeStats,
  type CollectionStats,
  type ProductStats,
  type BrandStats,
  type WalletStats,
  type UserReportStats,
  type SubscriptionPlanStats,
} from '../api/admin-analytics';
import type { AdminStatsResponse } from '../types/admin';
import { useTheme } from '../contexts/ThemeContext';

const { Title, Text, Paragraph } = Typography;

const C = {
  primary: '#DAF94D',
  secondary: '#806CFF',
  tertiary: '#E5507E',
  success: '#8B9D2D',
  pink: '#D8365D',
  purple: '#4F1FE3',
};
const PIE_COLORS = [C.primary, C.secondary, C.tertiary, C.success, C.pink, C.purple, '#C3D534'];

function settled<T>(r: PromiseSettledResult<{ data?: T }>): T | null {
  return r.status === 'fulfilled' ? (r.value.data ?? null) : null;
}

/* ── Inline stat row inside a grouped card ── */
function StatRow({ items, isDark }: {
  items: { label: string; value: string | number; color?: string; icon?: React.ReactNode; onClick?: () => void }[];
  isDark: boolean;
}) {
  const bg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)';
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {items.map((item, i) => (
        <div
          key={i}
          onClick={item.onClick}
          style={{
            flex: '1 1 0',
            minWidth: 100,
            padding: '10px 14px',
            background: bg,
            borderRight: i < items.length - 1 ? `1px solid ${border}` : undefined,
            cursor: item.onClick ? 'pointer' : 'default',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { if (item.onClick) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = bg; }}
        >
          <Text type="secondary" style={{ fontSize: 11, display: 'block', lineHeight: 1.3 }}>{item.icon} {item.label}</Text>
          <Text style={{ fontSize: 18, fontWeight: 600, color: item.color }}>{item.value}</Text>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [ug, setUg] = useState<UserGrowthAnalytics | null>(null);
  const [ct, setCt] = useState<ContentTrendsAnalytics | null>(null);
  const [eng, setEng] = useState<EngagementAnalytics | null>(null);
  const [rev, setRev] = useState<RevenueAnalytics | null>(null);
  const [ph, setPh] = useState<PlatformHealthAnalytics | null>(null);
  const [ev, setEv] = useState<EventStats | null>(null);
  const [nft, setNft] = useState<NftStats | null>(null);
  const [badge, setBadge] = useState<BadgeStats | null>(null);
  const [coll, setColl] = useState<CollectionStats | null>(null);
  const [prod, setProd] = useState<ProductStats | null>(null);
  const [brand, setBrand] = useState<BrandStats | null>(null);
  const [wallet, setWallet] = useState<WalletStats | null>(null);
  const [report, setReport] = useState<UserReportStats | null>(null);
  const [sub, setSub] = useState<SubscriptionPlanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await Promise.allSettled([
          fetchAdminStats(), fetchUserGrowthAnalytics(), fetchContentTrends(),
          fetchEngagementAnalytics(), fetchRevenueAnalyticsData(), fetchPlatformHealth(),
          fetchEventStats(), fetchNftStats(), fetchBadgeStats(), fetchCollectionStats(),
          fetchProductStats(), fetchBrandStats(), fetchWalletStats(), fetchUserReportStats(),
          fetchSubscriptionPlanStats(),
        ]);
        if (cancelled) return;
        setStats(settled(r[0])); setUg(settled(r[1])); setCt(settled(r[2]));
        setEng(settled(r[3])); setRev(settled(r[4])); setPh(settled(r[5]));
        setEv(settled(r[6])); setNft(settled(r[7])); setBadge(settled(r[8]));
        setColl(settled(r[9])); setProd(settled(r[10])); setBrand(settled(r[11]));
        setWallet(settled(r[12])); setReport(settled(r[13])); setSub(settled(r[14]));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Chart styling
  const grid = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const tick = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
  const ttBg = isDark ? '#242424' : '#ffffff';
  const ttBorder = isDark ? 'rgba(255,255,255,0.12)' : '#f0f0f0';
  const ttStyle: CSSProperties = { backgroundColor: ttBg, border: `1px solid ${ttBorder}`, borderRadius: 6, fontSize: 13 };
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const growthData = ug?.userGrowthByDay?.map((d) => ({ date: fmt(d.date), 'New Users': d.newUsers, 'Active Users': d.activeUsers })) ?? [];
  const contentData = ct?.contentByDay?.map((d) => ({ date: fmt(d.date), Posts: d.posts, Comments: d.comments })) ?? [];
  const engData = eng?.engagementTrends?.map((d) => ({ date: fmt(d.date), Likes: d.likes, Comments: d.comments, Shares: d.shares })) ?? [];
  const revData = rev?.revenueByDay?.map((d) => ({ date: fmt(d.date), Revenue: d.revenue })) ?? [];
  const pieData = ct?.topContentTypes?.map((t) => ({ name: t.type, value: t.count })) ?? [];

  const num = (v: number | undefined | null) => v != null ? v.toLocaleString() : '-';
  const usd = (v: number | undefined | null) => v != null ? `$${v.toFixed(2)}` : '-';

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <ArrowUpOutlined style={{ color: C.success }} />;
    if (trend === 'down') return <ArrowDownOutlined style={{ color: C.pink }} />;
    return <LineOutlined style={{ color: tick }} />;
  };

  // Fix: equal height for hero cards
  const heroCardStyle: CSSProperties = { height: '100%', display: 'flex', flexDirection: 'column' };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div>
      {/* ═══ HEADER ═══ */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>Dashboard</Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>Platform overview and key metrics</Paragraph>
        </div>
        <Space>
          <CalendarOutlined />
          <Text type="secondary">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        </Space>
      </div>

      {error && <Alert message={error} type="error" closable style={{ marginBottom: 12 }} />}

      {/* ═══ 4 HERO KPIs ═══ */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} lg={6}>
          <Card bordered size="small" style={heroCardStyle}>
            <Statistic title="Total Users" value={stats?.users ?? 0} prefix={<UserOutlined />} valueStyle={{ fontWeight: 700 }} />
            <div style={{ marginTop: 'auto', paddingTop: 4 }}>
              {ug ? <Text style={{ color: ug.growthRate >= 0 ? C.success : C.pink, fontSize: 12 }}>{ug.growthRate >= 0 ? <RiseOutlined /> : <FallOutlined />} {ug.growthRate.toFixed(1)}% growth</Text> : <Text type="secondary" style={{ fontSize: 12 }}>&nbsp;</Text>}
            </div>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card bordered size="small" style={heroCardStyle}>
            <Statistic title="Total Posts" value={stats?.posts ?? 0} prefix={<FileTextOutlined />} valueStyle={{ fontWeight: 700 }} />
            <div style={{ marginTop: 'auto', paddingTop: 4 }}>
              {ct ? <Text style={{ color: C.secondary, fontSize: 12 }}>+{ct.postsLastMonth} last month</Text> : <Text type="secondary" style={{ fontSize: 12 }}>&nbsp;</Text>}
            </div>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card bordered size="small" style={heroCardStyle}>
            <Statistic title="Banned Users" value={stats?.bannedUsers ?? 0} prefix={<StopOutlined />} valueStyle={{ fontWeight: 700, color: (stats?.bannedUsers ?? 0) > 0 ? C.pink : undefined }} />
            <div style={{ marginTop: 'auto', paddingTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{stats && stats.users > 0 ? ((stats.bannedUsers / stats.users) * 100).toFixed(1) : 0}% of total</Text>
            </div>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card bordered size="small" style={heroCardStyle}>
            <Statistic title="Admin Logs" value={stats?.adminLogs ?? 0} prefix={<SafetyCertificateOutlined />} valueStyle={{ fontWeight: 700 }} />
            <div style={{ marginTop: 'auto', paddingTop: 4 }}>
              <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }} onClick={() => navigate('/system/logs')}>View logs <ArrowRightOutlined /></Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ═══ CONTENT ACTIVITY + CONTENT BY TYPE (50/50) ═══ */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {contentData.length > 0 && (
          <Col xs={24} lg={12}>
            <Card bordered size="small" title="Content Activity — Last 30 Days" extra={<Button type="link" size="small" onClick={() => navigate('/content/posts')}>View <ArrowRightOutlined /></Button>} style={{ height: '100%' }}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={contentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                  <XAxis dataKey="date" tick={{ fill: tick, fontSize: 10 }} tickLine={false} axisLine={{ stroke: grid }} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: tick, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={ttStyle} />
                  <Legend />
                  <Bar dataKey="Posts" fill={C.primary} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Comments" fill={C.secondary} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        )}
        {pieData.length > 0 && (
          <Col xs={24} lg={12}>
            <Card bordered size="small" title="Content by Type" style={{ height: '100%' }}>
              <Row gutter={16} align="middle">
                <Col xs={24} sm={12}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {pieData.map((_e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Col>
                <Col xs={24} sm={12}>
                  {ct?.topContentTypes?.map((t, i) => (
                    <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'}` }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <Text style={{ fontSize: 13, flex: 1 }}>{t.type}</Text>
                      <Text strong style={{ fontSize: 13 }}>{t.count}</Text>
                      <Text type="secondary" style={{ fontSize: 12, minWidth: 40, textAlign: 'right' }}>{t.percentage}%</Text>
                    </div>
                  ))}
                </Col>
              </Row>
            </Card>
          </Col>
        )}
      </Row>

      {/* ═══ CATALOG (Categories, Brands, Products) ═══ */}
      <Card bordered size="small" title={<><ShopOutlined /> Catalog</>} style={{ marginBottom: 12, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
        <StatRow isDark={isDark} items={[
          { label: 'Categories', value: num(prod?.byCategoryCount) },
          { label: 'Brands', value: num(brand?.total), color: C.secondary, onClick: () => navigate('/brands') },
          { label: 'Products', value: num(prod?.total), color: C.primary, onClick: () => navigate('/products') },
          { label: 'New This Month', value: num(prod?.addedThisMonth), color: C.success },
        ]} />
      </Card>

      {/* ═══ WEB3 ═══ */}
      <Card bordered size="small" title={<><WalletOutlined /> Web3</>} style={{ marginBottom: 12, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
        <StatRow isDark={isDark} items={[
          { label: 'NFTs', value: num(nft?.total), icon: <PictureOutlined />, color: C.secondary, onClick: () => navigate('/web3/nfts') },
          { label: 'NFT Transactions', value: num(nft?.totalTransactions), color: C.pink },
          { label: 'Wallets', value: num(wallet?.total), color: C.purple, onClick: () => navigate('/web3/wallets') },
          { label: 'Subscriptions', value: num(sub?.totalSubscriptions), icon: <CrownOutlined />, color: C.primary },
        ]} />
      </Card>

      {/* ═══ GAMIFICATION ═══ */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} lg={12}>
          <Card bordered size="small" title={<><TrophyOutlined /> Gamification</>} style={{ height: '100%', overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
            <StatRow isDark={isDark} items={[
              { label: 'Events', value: `${num(ev?.published)} / ${num(ev?.total)}`, icon: <CalendarOutlined />, color: C.tertiary, onClick: () => navigate('/events') },
              { label: 'Badges', value: num(badge?.total), color: C.primary, onClick: () => navigate('/gamification/badges') },
              { label: 'Collections', value: num(coll?.total), color: C.secondary, onClick: () => navigate('/gamification/collections') },
            ]} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card bordered size="small" title={<><FlagOutlined /> Moderation</>} style={{ height: '100%', overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
            <StatRow isDark={isDark} items={[
              { label: 'Total Reports', value: num(report?.total), onClick: () => navigate('/moderation/user-reports') },
              { label: 'Open', value: num(report?.open), color: (report?.open ?? 0) > 0 ? C.pink : undefined },
              { label: 'Resolved', value: num(report?.resolved), color: C.success },
            ]} />
          </Card>
        </Col>
      </Row>

      {/* ═══ REVENUE ═══ */}
      {rev && (
        <Card bordered size="small" title={<><DollarOutlined /> Revenue</>} style={{ marginBottom: 12, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
          <StatRow isDark={isDark} items={[
            { label: 'Total Revenue', value: usd(rev.totalRevenue) },
            { label: 'Last Month', value: usd(rev.revenueLastMonth), color: rev.revenueGrowthRate > 0 ? C.success : rev.revenueGrowthRate < 0 ? C.pink : undefined },
            { label: 'Growth', value: `${rev.revenueGrowthRate > 0 ? '+' : ''}${rev.revenueGrowthRate.toFixed(1)}%`, color: rev.revenueGrowthRate >= 0 ? C.success : C.pink },
            { label: 'Subscription Rev', value: usd(rev.subscriptionRevenue), color: C.primary },
            { label: 'NFT Sales', value: usd(rev.nftRevenue), color: C.secondary },
          ]} />
        </Card>
      )}

      {/* ═══ USER GROWTH CHART ═══ */}
      {growthData.length > 0 && (
        <Card bordered size="small" title="User Growth — Last 30 Days" extra={<Button type="link" size="small" onClick={() => navigate('/users')}>View Users <ArrowRightOutlined /></Button>} style={{ marginBottom: 12 }}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={growthData}>
              <defs>
                <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.primary} stopOpacity={0.3} /><stop offset="95%" stopColor={C.primary} stopOpacity={0} /></linearGradient>
                <linearGradient id="gAct" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.secondary} stopOpacity={0.3} /><stop offset="95%" stopColor={C.secondary} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="date" tick={{ fill: tick, fontSize: 10 }} tickLine={false} axisLine={{ stroke: grid }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: tick, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={ttStyle} />
              <Legend />
              <Area type="monotone" dataKey="New Users" stroke={C.primary} fill="url(#gNew)" strokeWidth={2} />
              <Area type="monotone" dataKey="Active Users" stroke={C.secondary} fill="url(#gAct)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ═══ ENGAGEMENT TRENDS ═══ */}
      {engData.length > 0 && (
        <Card bordered size="small" title="Engagement Trends — Last 30 Days" style={{ marginBottom: 12 }}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={engData}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="date" tick={{ fill: tick, fontSize: 10 }} tickLine={false} axisLine={{ stroke: grid }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: tick, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={ttStyle} />
              <Legend />
              <Line type="monotone" dataKey="Likes" stroke={C.primary} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Comments" stroke={C.secondary} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Shares" stroke={C.tertiary} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ═══ REVENUE CHART ═══ */}
      {revData.length > 0 && (
        <Card bordered size="small" title="Revenue — Last 30 Days" extra={rev ? <Tag color={rev.revenueGrowthRate >= 0 ? 'green' : 'red'}>{rev.revenueGrowthRate >= 0 ? '+' : ''}{rev.revenueGrowthRate.toFixed(1)}%</Tag> : null} style={{ marginBottom: 12 }}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revData}>
              <defs><linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.success} stopOpacity={0.3} /><stop offset="95%" stopColor={C.success} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="date" tick={{ fill: tick, fontSize: 10 }} tickLine={false} axisLine={{ stroke: grid }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: tick, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={ttStyle} formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Revenue']} />
              <Area type="monotone" dataKey="Revenue" stroke={C.success} fill="url(#gRev)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ═══ PLATFORM HEALTH + TOP USERS ═══ */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {ph && (
          <Col xs={24} lg={12}>
            <Card bordered size="small" title="Platform Health" style={{ height: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <Progress
                  type="dashboard"
                  percent={Math.round(ph.overallScore)}
                  size={110}
                  strokeColor={{ '0%': C.tertiary, '50%': C.primary, '100%': C.success }}
                  format={(p) => <span style={{ fontSize: 20, fontWeight: 700 }}>{p ?? 0}</span>}
                />
                <div><Text type="secondary" style={{ fontSize: 11 }}>Overall Score</Text></div>
              </div>
              <Row gutter={[8, 8]}>
                {([
                  { label: 'User Activity', d: ph.userActivity },
                  { label: 'Content Quality', d: ph.contentQuality },
                  { label: 'Engagement', d: ph.engagement },
                  { label: 'Revenue', d: ph.revenue },
                ] as const).map((item) => (
                  <Col xs={12} key={item.label}>
                    <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 11 }}>{item.label}</Text>
                        {getTrendIcon(item.d.trend)}
                      </div>
                      <Text style={{ fontSize: 16, fontWeight: 600 }}>{item.d.score.toFixed(1)}</Text>
                      <Text type="secondary" style={{ fontSize: 10 }}> / 100</Text>
                    </div>
                  </Col>
                ))}
              </Row>
              {ph.issues.length > 0 && (
                <>
                  <Divider style={{ margin: '10px 0 6px' }} />
                  {ph.issues.map((issue, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      {issue.severity === 'high' ? <ExclamationCircleOutlined style={{ color: C.pink, fontSize: 12 }} /> : issue.severity === 'medium' ? <WarningOutlined style={{ color: C.tertiary, fontSize: 12 }} /> : <MinusCircleOutlined style={{ color: tick, fontSize: 12 }} />}
                      <Tag color={issue.severity === 'high' ? 'red' : issue.severity === 'medium' ? 'orange' : 'default'} style={{ fontSize: 10, lineHeight: '16px' }}>{issue.severity.toUpperCase()}</Tag>
                      <Text style={{ fontSize: 11 }}>{issue.message}</Text>
                    </div>
                  ))}
                </>
              )}
            </Card>
          </Col>
        )}
        <Col xs={24} lg={ph ? 12 : 24}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {eng && eng.topEngagedUsers.length > 0 && (
              <Card bordered size="small" title="Top Engaged Users">
                <Table dataSource={eng.topEngagedUsers.slice(0, 5)} rowKey="userId" size="small" pagination={false} columns={[
                  { title: '#', key: 'r', width: 36, render: (_: unknown, __: unknown, i: number) => <Text type="secondary">{i + 1}</Text> },
                  { title: 'User', dataIndex: 'username', render: (u: string | null, r: { userId: string }) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/users/${r.userId}`)}>{u || r.userId.slice(0, 8)}</Button> },
                  { title: 'Score', dataIndex: 'engagementScore', align: 'right' as const, render: (s: number) => <Tag color="purple">{s}</Tag> },
                ]} />
              </Card>
            )}
            {rev && rev.topRevenueUsers.filter((u) => u.totalSpent > 0).length > 0 && (
              <Card bordered size="small" title="Top Revenue Users">
                <Table dataSource={rev.topRevenueUsers.filter((u) => u.totalSpent > 0).slice(0, 5)} rowKey="userId" size="small" pagination={false} columns={[
                  { title: '#', key: 'r', width: 36, render: (_: unknown, __: unknown, i: number) => <Text type="secondary">{i + 1}</Text> },
                  { title: 'User', dataIndex: 'username', render: (u: string | null, r: { userId: string }) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/users/${r.userId}`)}>{u || r.userId.slice(0, 8)}</Button> },
                  { title: 'Spent', dataIndex: 'totalSpent', align: 'right' as const, render: (s: number) => <Text strong>${s.toFixed(2)}</Text> },
                ]} />
              </Card>
            )}
          </Space>
        </Col>
      </Row>

    </div>
  );
}

export default Dashboard;
