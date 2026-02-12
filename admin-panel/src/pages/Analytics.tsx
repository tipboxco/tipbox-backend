import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Empty,
  Alert,
  Select,
  Space,
  Tag,
  Tabs,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PieChartOutlined,
  UserOutlined,
  FileTextOutlined,
  HeartOutlined,
  DollarOutlined,
  RiseOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import { type StatItemData } from '../components/StatItem';
import {
  fetchDashboardAnalytics,
  fetchUserGrowth,
  fetchEngagementMetrics,
  fetchContentAnalytics,
  fetchRevenueAnalytics,
} from '../api/admin-system';
import type {
  AdminDashboardAnalyticsResponse,
  AdminUserGrowthResponse,
  AdminEngagementMetricsResponse,
  AdminContentAnalyticsResponse,
  AdminRevenueAnalyticsResponse,
} from '../api/admin-system';
import { TABLE_COLUMN_WIDTHS } from '../constants/table-widths';

type GrowthPeriod = 'daily' | 'weekly' | 'monthly';

function Analytics() {
  const [dashboard, setDashboard] = useState<AdminDashboardAnalyticsResponse | null>(null);
  const [userGrowth, setUserGrowth] = useState<AdminUserGrowthResponse | null>(null);
  const [engagement, setEngagement] = useState<AdminEngagementMetricsResponse | null>(null);
  const [content, setContent] = useState<AdminContentAnalyticsResponse | null>(null);
  const [revenue, setRevenue] = useState<AdminRevenueAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [growthPeriod, setGrowthPeriod] = useState<GrowthPeriod>('weekly');

  useEffect(() => {
    loadAllAnalytics();
  }, []);

  useEffect(() => {
    loadUserGrowth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [growthPeriod]);

  const loadAllAnalytics = async () => {
    setLoading(true);
    try {
      const [dashRes, engagementRes, contentRes, revenueRes] = await Promise.all([
        fetchDashboardAnalytics(),
        fetchEngagementMetrics(),
        fetchContentAnalytics(),
        fetchRevenueAnalytics(),
      ]);
      setDashboard(dashRes.data);
      setEngagement(engagementRes.data);
      setContent(contentRes.data);
      setRevenue(revenueRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const loadUserGrowth = async () => {
    try {
      const res = await fetchUserGrowth({ period: growthPeriod });
      setUserGrowth(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load user growth data');
    }
  };

  const statsData: StatItemData[] | undefined = dashboard
    ? [
        {
          label: 'Total Users',
          value: dashboard.users.total,
          icon: <UserOutlined />,
        },
        {
          label: 'Active Users',
          value: dashboard.users.active,
          icon: <UserOutlined />,
        },
        {
          label: 'Total Posts',
          value: dashboard.content.totalPosts,
          icon: <FileTextOutlined />,
        },
        {
          label: 'Total Revenue',
          value: `$${dashboard.revenue.totalRevenue.toFixed(2)}`,
          icon: <DollarOutlined />,
        },
      ]
    : undefined;

  const growthColumns: ColumnsType<{ date: string; newUsers: number; activeUsers: number }> = [
    {
      title: 'Period',
      dataIndex: 'date',
      key: 'date',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      render: (date) => new Date(date).toLocaleDateString('en-US'),
    },
    {
      title: 'New Users',
      dataIndex: 'newUsers',
      key: 'newUsers',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
    {
      title: 'Active Users',
      dataIndex: 'activeUsers',
      key: 'activeUsers',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
  ];

  const contributorColumns: ColumnsType<
    NonNullable<AdminEngagementMetricsResponse['topContributors'][0]>
  > = [
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Posts',
      dataIndex: 'postCount',
      key: 'postCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
    {
      title: 'Comments',
      dataIndex: 'commentCount',
      key: 'commentCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
    {
      title: 'Likes',
      dataIndex: 'likeCount',
      key: 'likeCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
  ];

  const contentTypeColumns: ColumnsType<
    NonNullable<AdminContentAnalyticsResponse['byType'][0]>
  > = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (type) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
    {
      title: 'Views',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
    {
      title: 'Likes',
      dataIndex: 'likeCount',
      key: 'likeCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
  ];

  const trendingColumns: ColumnsType<NonNullable<AdminContentAnalyticsResponse['trending'][0]>> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (score) => <Tag color="gold">{score.toFixed(2)}</Tag>,
    },
  ];

  const revenueMonthlyColumns: ColumnsType<
    NonNullable<AdminRevenueAnalyticsResponse['monthly'][0]>
  > = [
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (month) => new Date(month).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
    },
    {
      title: 'Total Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (val) => `$${val.toFixed(2)}`,
    },
    {
      title: 'Subscriptions',
      dataIndex: 'subscriptionRevenue',
      key: 'subscriptionRevenue',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (val) => `$${val.toFixed(2)}`,
    },
    {
      title: 'Transactions',
      dataIndex: 'transactionRevenue',
      key: 'transactionRevenue',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (val) => `$${val.toFixed(2)}`,
    },
  ];

  const growthData =
    growthPeriod === 'daily'
      ? userGrowth?.daily.map((d) => ({ date: d.date, newUsers: d.newUsers, activeUsers: d.activeUsers }))
      : growthPeriod === 'weekly'
      ? userGrowth?.weekly.map((w) => ({ date: w.weekStart, newUsers: w.newUsers, activeUsers: w.activeUsers }))
      : userGrowth?.monthly.map((m) => ({ date: m.monthStart, newUsers: m.newUsers, activeUsers: m.activeUsers }));

  return (
    <div>
      <PageHeader
        title="Analytics Dashboard"
        description="Comprehensive platform analytics and insights"
        icon={<PieChartOutlined />}
        statsData={statsData}
        statsLoading={loading}
      />

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Overview Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="User Growth Rate"
              value={dashboard?.users.growthRate ?? 0}
              precision={1}
              valueStyle={{ color: '#3f8600' }}
              prefix={<RiseOutlined />}
              suffix="%"
            />
            <div style={{ marginTop: 8, fontSize: '12px', color: '#888' }}>
              {dashboard?.users.newThisWeek ?? 0} new this week
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="Engagement Rate"
              value={engagement?.avgEngagementRate ?? 0}
              precision={1}
              valueStyle={{ color: '#cf1322' }}
              prefix={<HeartOutlined />}
              suffix="%"
            />
            <div style={{ marginTop: 8, fontSize: '12px', color: '#888' }}>
              {engagement?.posts.thisWeek ?? 0} posts this week
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="Active Subscriptions"
              value={dashboard?.revenue.activeSubscriptions ?? 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<UserOutlined />}
            />
            <div style={{ marginTop: 8, fontSize: '12px', color: '#888' }}>
              ${dashboard?.revenue.revenueThisMonth.toFixed(2) ?? '0.00'} this month
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="Total Comments"
              value={dashboard?.content.totalComments ?? 0}
              valueStyle={{ color: '#722ed1' }}
              prefix={<FileTextOutlined />}
            />
            <div style={{ marginTop: 8, fontSize: '12px', color: '#888' }}>
              {dashboard?.content.commentsThisWeek ?? 0} this week
            </div>
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="users"
        items={[
          {
            key: 'users',
            label: (
              <span>
                <UserOutlined />
                User Analytics
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <Card
                    bordered={false}
                    title="User Growth"
                    extra={
                      <Select
                        value={growthPeriod}
                        onChange={(val) => setGrowthPeriod(val)}
                        style={{ width: 120 }}
                      >
                        <Select.Option value="daily">Daily</Select.Option>
                        <Select.Option value="weekly">Weekly</Select.Option>
                        <Select.Option value="monthly">Monthly</Select.Option>
                      </Select>
                    }
                  >
                    <Table
                      columns={growthColumns}
                      dataSource={growthData}
                      loading={!userGrowth}
                      rowKey="date"
                      pagination={{ pageSize: 10 }}
                      locale={{
                        emptyText: <Empty description="No growth data available" />,
                      }}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'engagement',
            label: (
              <span>
                <HeartOutlined />
                Engagement
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card bordered={false} title="Engagement Overview">
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                      <Statistic
                        title="Total Posts"
                        value={engagement?.posts.total ?? 0}
                        suffix={`(${engagement?.posts.thisWeek ?? 0} this week)`}
                      />
                      <Statistic
                        title="Total Comments"
                        value={engagement?.comments.total ?? 0}
                        suffix={`(${engagement?.comments.thisWeek ?? 0} this week)`}
                      />
                      <Statistic
                        title="Total Likes"
                        value={engagement?.likes.total ?? 0}
                        suffix={`(${engagement?.likes.thisWeek ?? 0} this week)`}
                      />
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card bordered={false} title="Posts by Type">
                    {engagement?.posts.byType && Object.keys(engagement.posts.byType).length > 0 ? (
                      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {Object.entries(engagement.posts.byType).map(([type, count]) => (
                          <div key={type} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Tag color="blue">{type}</Tag>
                            <span>{count}</span>
                          </div>
                        ))}
                      </Space>
                    ) : (
                      <Empty description="No post type data" />
                    )}
                  </Card>
                </Col>
                <Col xs={24}>
                  <Card bordered={false} title={<><TrophyOutlined /> Top Contributors</>}>
                    <Table
                      columns={contributorColumns}
                      dataSource={engagement?.topContributors}
                      loading={!engagement}
                      rowKey="userId"
                      pagination={false}
                      locale={{
                        emptyText: <Empty description="No contributor data" />,
                      }}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'content',
            label: (
              <span>
                <FileTextOutlined />
                Content
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card bordered={false} title="Content by Type">
                    <Table
                      columns={contentTypeColumns}
                      dataSource={content?.byType}
                      loading={!content}
                      rowKey="type"
                      pagination={false}
                      locale={{
                        emptyText: <Empty description="No content type data" />,
                      }}
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card bordered={false} title="Trending Posts">
                    <Table
                      columns={trendingColumns}
                      dataSource={content?.trending}
                      loading={!content}
                      rowKey="postId"
                      pagination={false}
                      locale={{
                        emptyText: <Empty description="No trending posts" />,
                      }}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'revenue',
            label: (
              <span>
                <DollarOutlined />
                Revenue
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card bordered={false} title="Revenue Overview">
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                      <Statistic
                        title="Total Revenue"
                        value={revenue?.total ?? 0}
                        prefix="$"
                        precision={2}
                      />
                      <Statistic
                        title="This Month"
                        value={revenue?.thisMonth ?? 0}
                        prefix="$"
                        precision={2}
                      />
                      <Statistic
                        title="Active Subscriptions"
                        value={revenue?.subscriptions.active ?? 0}
                        suffix={`($${revenue?.subscriptions.revenue.toFixed(2) ?? '0.00'})`}
                      />
                      <Statistic
                        title="Transactions"
                        value={revenue?.transactions.count ?? 0}
                        suffix={`($${revenue?.transactions.volume.toFixed(2) ?? '0.00'})`}
                      />
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card bordered={false} title="Revenue by Source">
                    {revenue?.bySource && Object.keys(revenue.bySource).length > 0 ? (
                      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {Object.entries(revenue.bySource).map(([source, amount]) => (
                          <div key={source} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Tag color="green">{source}</Tag>
                            <span>${(amount as number).toFixed(2)}</span>
                          </div>
                        ))}
                      </Space>
                    ) : (
                      <Empty description="No revenue source data" />
                    )}
                  </Card>
                </Col>
                <Col xs={24}>
                  <Card bordered={false} title="Monthly Revenue">
                    <Table
                      columns={revenueMonthlyColumns}
                      dataSource={revenue?.monthly}
                      loading={!revenue}
                      rowKey="month"
                      pagination={{ pageSize: 12 }}
                      locale={{
                        emptyText: <Empty description="No monthly revenue data" />,
                      }}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </div>
  );
}

export default Analytics;
