import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Table,
  Space,
  Tag,
  Alert,
  Popconfirm,
  Input,
  Switch,
  Statistic,
  Progress,
  message,
  Modal,
  Empty,
  Tooltip,
  Descriptions,
  Badge,
  Divider,
  Typography,
  Flex,
  AutoComplete,
  Avatar,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ThunderboltOutlined,
  ClearOutlined,
  ReloadOutlined,
  UserOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  DeleteOutlined,
  SendOutlined,
  TeamOutlined,
  EyeInvisibleOutlined,
  PieChartOutlined,
  SearchOutlined,
  HistoryOutlined,
  ToolOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { fetchUsers } from '../../api/admin-users';
import type { AdminUserListItem } from '../../types/admin';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchFeedManagementStats,
  fetchQueueStats,
  fetchEmptyFeedUsers,
  fetchJobHistory,
  fetchUserFeedLookup,
  triggerCleanup,
  triggerDistribution,
  triggerFullRedistribution,
  refreshUserFeed,
  seedEmptyFeeds,
  cleanQueue,
  fetchCleanupStatus,
  toggleCleanup,
  type FeedManagementStats,
  type QueueStats,
  type EmptyFeedUser,
  type JobHistoryItem,
  type UserFeedLookupResult,
} from '../../api/admin-feed-management';

const { Text } = Typography;

const SOURCE_COLORS: Record<string, string> = {
  MUTUAL_TRUST: 'gold',
  TRUSTER: 'green',
  TRUSTER_NETWORK: 'cyan',
  INVENTORY_MATCH: 'blue',
  PRODUCT_GROUP_MATCH: 'geekblue',
  BOOSTED: 'volcano',
  TRENDING: 'magenta',
  ENGAGEMENT_HIGH: 'orange',
  CATEGORY_MATCH: 'purple',
  NEW_USER: 'default',
};

function FeedManagement() {
  const [stats, setStats] = useState<FeedManagementStats | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [emptyFeedUsers, setEmptyFeedUsers] = useState<EmptyFeedUser[]>([]);
  const [emptyFeedTotal, setEmptyFeedTotal] = useState(0);
  const [emptyFeedPage, setEmptyFeedPage] = useState(1);
  const [cleanupEnabled, setCleanupEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(true);
  const [emptyLoading, setEmptyLoading] = useState(false);
  const [cleanupToggleLoading, setCleanupToggleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [distributionPostId, setDistributionPostId] = useState('');
  const [distributionModalOpen, setDistributionModalOpen] = useState(false);

  // Job History state
  const [jobHistory, setJobHistory] = useState<{ completed: JobHistoryItem[]; failed: JobHistoryItem[] } | null>(null);
  const [jobHistoryLoading, setJobHistoryLoading] = useState(false);

  // User Feed Lookup state
  const [lookupSearch, setLookupSearch] = useState('');
  const [lookupResult, setLookupResult] = useState<UserFeedLookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupSearched, setLookupSearched] = useState(false);

  // User autocomplete state
  const [userSuggestions, setUserSuggestions] = useState<AdminUserListItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFeedManagementStats();
      if (res.data) setStats(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadQueueStats = useCallback(async () => {
    setQueueLoading(true);
    try {
      const res = await fetchQueueStats();
      if (res.data) setQueueStats(res.data);
    } catch {
      // Queue stats may fail silently
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const loadEmptyFeedUsers = useCallback(async (page = 1) => {
    setEmptyLoading(true);
    try {
      const res = await fetchEmptyFeedUsers({ limit: 10, offset: (page - 1) * 10 });
      setEmptyFeedUsers(res.data ?? []);
      setEmptyFeedTotal(res.pagination?.total ?? 0);
      setEmptyFeedPage(page);
    } catch {
      // silent
    } finally {
      setEmptyLoading(false);
    }
  }, []);

  const loadCleanupStatus = useCallback(async () => {
    try {
      const res = await fetchCleanupStatus();
      if (res.data) setCleanupEnabled(res.data.cleanupEnabled);
    } catch {
      // default to enabled
    }
  }, []);

  const loadJobHistory = useCallback(async () => {
    setJobHistoryLoading(true);
    try {
      const res = await fetchJobHistory();
      if (res.data) setJobHistory(res.data);
    } catch {
      // silent
    } finally {
      setJobHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadQueueStats();
    loadEmptyFeedUsers(1);
    loadCleanupStatus();
    loadJobHistory();
  }, [loadStats, loadQueueStats, loadEmptyFeedUsers, loadCleanupStatus, loadJobHistory]);

  const handleLookupUser = async (search?: string) => {
    const term = (search ?? lookupSearch).trim();
    if (!term) return;
    setLookupLoading(true);
    setLookupSearched(true);
    try {
      const res = await fetchUserFeedLookup(term);
      setLookupResult(res.data ?? null);
    } catch {
      setLookupResult(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleUserSearch = (value: string) => {
    setLookupSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setUserSuggestions([]);
      return;
    }
    setSuggestionsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchUsers({ search: value.trim(), limit: 8 });
        setUserSuggestions(res.data ?? []);
      } catch {
        setUserSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 300);
  };

  const handleSelectUser = (value: string) => {
    setLookupSearch(value);
    setUserSuggestions([]);
    handleLookupUser(value);
  };

  const autocompleteOptions = useMemo(
    () =>
      userSuggestions.map((u) => ({
        value: u.email ?? u.id,
        label: (
          <Flex align="center" gap={10}>
            <Avatar src={u.avatarUrl} icon={<UserOutlined />} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.displayName || u.userName || 'No name'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.email} {u.userName ? `· @${u.userName}` : ''}
              </div>
            </div>
          </Flex>
        ),
      })),
    [userSuggestions],
  );

  const handleToggleCleanup = async (enabled: boolean) => {
    setCleanupToggleLoading(true);
    try {
      await toggleCleanup(enabled);
      setCleanupEnabled(enabled);
      message.success(`Auto cleanup ${enabled ? 'enabled' : 'disabled'}`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to toggle cleanup');
    } finally {
      setCleanupToggleLoading(false);
    }
  };

  const handleTriggerCleanup = async () => {
    setActionLoading('cleanup');
    try {
      await triggerCleanup();
      message.success('Feed cleanup job queued');
      loadQueueStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to trigger cleanup');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFullRedistribution = async () => {
    setActionLoading('redistribution');
    try {
      const res = await triggerFullRedistribution();
      message.success(res.message || 'Full redistribution queued');
      loadQueueStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to trigger redistribution');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSeedEmptyFeeds = async () => {
    setActionLoading('seed');
    try {
      const res = await seedEmptyFeeds();
      message.success(res.message || 'Feed seeding queued');
      loadQueueStats();
      loadEmptyFeedUsers(1);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to seed feeds');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCleanQueue = async () => {
    setActionLoading('clean-queue');
    try {
      await cleanQueue();
      message.success('Queue cleaned');
      loadQueueStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to clean queue');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefreshUserFeed = async (userId: string) => {
    setActionLoading(`refresh-${userId}`);
    try {
      const res = await refreshUserFeed(userId);
      message.success(res.message || 'User feed refreshed');
      loadEmptyFeedUsers(emptyFeedPage);
      loadQueueStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to refresh user feed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDistributeSinglePost = async () => {
    if (!distributionPostId.trim()) return;
    setActionLoading('distribute-single');
    try {
      await triggerDistribution(distributionPostId.trim(), 'full');
      message.success(`Distribution queued for post ${distributionPostId}`);
      setDistributionModalOpen(false);
      setDistributionPostId('');
      loadQueueStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to trigger distribution');
    } finally {
      setActionLoading(null);
    }
  };

  const emptyFeedColumns: ColumnsType<EmptyFeedUser> = [
    {
      title: 'User',
      key: 'user',
      width: 200,
      ellipsis: true,
      render: (_, record) => (
        <span>{record.username || record.displayName || record.email}</span>
      ),
    },
    {
      title: 'Trusts',
      dataIndex: 'trustCount',
      key: 'trustCount',
      width: 80,
      render: (v: number) => <Tag color={v > 0 ? 'green' : 'default'}>{v}</Tag>,
    },
    {
      title: 'Inventory',
      dataIndex: 'inventoryCount',
      key: 'inventoryCount',
      width: 90,
      render: (v: number) => <Tag color={v > 0 ? 'blue' : 'default'}>{v}</Tag>,
    },
    {
      title: 'Preferences',
      dataIndex: 'hasPreferences',
      key: 'hasPreferences',
      width: 100,
      render: (v: boolean) =>
        v ? <Tag color="green">Yes</Tag> : <Tag color="default">No</Tag>,
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Tooltip title="Refresh this user's feed">
          <Button
            size="small"
            type="link"
            icon={<ReloadOutlined />}
            loading={actionLoading === `refresh-${record.id}`}
            onClick={() => handleRefreshUserFeed(record.id)}
          />
        </Tooltip>
      ),
    },
  ];

  const jobColumns: ColumnsType<JobHistoryItem> = [
    {
      title: 'Post ID',
      dataIndex: 'postId',
      key: 'postId',
      width: 180,
      ellipsis: true,
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Type',
      dataIndex: 'scoringType',
      key: 'scoringType',
      width: 80,
      render: (v: string | null) => v ? <Tag>{v}</Tag> : '-',
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (v: number | null) => v != null ? `${(v / 1000).toFixed(1)}s` : '-',
    },
    {
      title: 'Finished',
      dataIndex: 'finishedAt',
      key: 'finishedAt',
      width: 160,
      render: (v: string | null) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: 'Attempts',
      dataIndex: 'attempts',
      key: 'attempts',
      width: 80,
    },
  ];

  const failedJobColumns: ColumnsType<JobHistoryItem> = [
    ...jobColumns,
    {
      title: 'Error',
      dataIndex: 'failedReason',
      key: 'failedReason',
      ellipsis: true,
      render: (v: string | null) => v ? <Text type="danger" style={{ fontSize: 12 }}>{v}</Text> : '-',
    },
  ];

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Feeds',
          value: stats.overview.totalFeeds,
          icon: <BarChartOutlined />,
        },
        {
          label: 'Feed Coverage',
          value: `${stats.overview.feedCoverage}%`,
          icon: <TeamOutlined />,
          valueColor:
            stats.overview.feedCoverage > 80
              ? '#52c41a'
              : stats.overview.feedCoverage > 50
                ? '#faad14'
                : '#ff4d4f',
        },
        {
          label: 'Empty Feed Users',
          value: stats.overview.usersWithEmptyFeeds,
          icon: <EyeInvisibleOutlined />,
          valueColor: stats.overview.usersWithEmptyFeeds > 0 ? '#ff4d4f' : '#52c41a',
        },
        {
          label: 'Avg Score',
          value: stats.scores.average,
          icon: <PieChartOutlined />,
        },
      ]
    : undefined;

  const getQueueBadge = (
    q: { waiting: number; active: number; failed: number } | undefined,
  ) => {
    if (!q) return 'default';
    if (q.failed > 0) return 'error';
    if (q.active > 0) return 'processing';
    if (q.waiting > 0) return 'warning';
    return 'success';
  };

  // Current scoring weights (hardcoded reference from FeedScoringService)
  const scoringWeights = {
    trust: { mutual: 35, userTrustsAuthor: 40, authorTrustsUser: 30 },
    inventory: { exactProduct: 30, productGroup: 20, categoryMatch: 15 },
    engagement: { trending: 20, highEngagement: 15 },
    recency: { hours48: 10, days14: 5 },
    boost: { min: 5, max: 10 },
  };

  return (
    <div>
      <PageHeader
        title="Feed Management"
        description="Monitor and manage the feed distribution system, queue workers, and cold start optimization"
        icon={<ThunderboltOutlined />}
        stats={statsData}
        statsLoading={loading}
      />

      {error && (
        <Alert
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 24 }}
          description={error}
        />
      )}

      {/* User Feed Lookup */}
      <Card
        variant="outlined"
        title={
          <Space>
            <SearchOutlined />
            User Feed Lookup
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Flex gap={8} style={{ marginBottom: lookupResult || lookupSearched ? 16 : 0 }}>
          <AutoComplete
            value={lookupSearch}
            options={autocompleteOptions}
            onSearch={handleUserSearch}
            onSelect={handleSelectUser}
            onChange={setLookupSearch}
            style={{ maxWidth: 400, flex: 1 }}
          >
            <Input
              placeholder="Search by email, username, or user ID"
              onPressEnter={() => handleLookupUser()}
              prefix={<SearchOutlined />}
              allowClear
              suffix={suggestionsLoading ? <SyncOutlined spin style={{ color: 'var(--ant-color-text-quaternary)' }} /> : undefined}
            />
          </AutoComplete>
          <Button
            type="primary"
            onClick={() => handleLookupUser()}
            loading={lookupLoading}
            disabled={!lookupSearch.trim()}
          >
            Lookup
          </Button>
          {lookupResult && (
            <Button
              icon={<ReloadOutlined />}
              loading={actionLoading === `refresh-${lookupResult.user.id}`}
              onClick={() => handleRefreshUserFeed(lookupResult.user.id)}
            >
              Refresh Feed
            </Button>
          )}
        </Flex>

        {lookupSearched && !lookupLoading && !lookupResult && (
          <Empty description="User not found" />
        )}

        {lookupResult && (
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Flex gap={12} align="start" style={{ marginBottom: 12 }}>
                <Avatar src={lookupResult.user.avatarUrl} icon={<UserOutlined />} size={48} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{lookupResult.user.displayName || lookupResult.user.username || 'No name'}</div>
                  {lookupResult.user.username && (
                    <div style={{ fontSize: 13, color: 'var(--ant-color-text-secondary)' }}>@{lookupResult.user.username}</div>
                  )}
                </div>
              </Flex>
              <Descriptions title="User Info" size="small" column={1}>
                <Descriptions.Item label="Email">{lookupResult.user.email}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={lookupResult.user.status === 'ACTIVE' ? 'green' : 'default'}>{lookupResult.user.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Joined">{new Date(lookupResult.user.createdAt).toLocaleDateString()}</Descriptions.Item>
              </Descriptions>
            </Col>
            <Col xs={24} md={8}>
              <Descriptions title="Feed Health" size="small" column={1}>
                <Descriptions.Item label="Total Feeds">
                  <strong style={{ color: lookupResult.feedHealth.totalFeeds === 0 ? '#ff4d4f' : undefined }}>
                    {lookupResult.feedHealth.totalFeeds}
                  </strong>
                </Descriptions.Item>
                <Descriptions.Item label="Unseen">{lookupResult.feedHealth.unseenFeeds}</Descriptions.Item>
                <Descriptions.Item label="Avg Score">{lookupResult.feedHealth.avgScore}</Descriptions.Item>
                <Descriptions.Item label="Score Range">{lookupResult.feedHealth.minScore} - {lookupResult.feedHealth.maxScore}</Descriptions.Item>
                <Descriptions.Item label="Last Feed">
                  {lookupResult.feedHealth.lastFeedAt ? new Date(lookupResult.feedHealth.lastFeedAt).toLocaleString() : 'Never'}
                </Descriptions.Item>
              </Descriptions>
            </Col>
            <Col xs={24} md={8}>
              <Descriptions title="Context" size="small" column={1}>
                <Descriptions.Item label="Trusts">{lookupResult.context.trustCount}</Descriptions.Item>
                <Descriptions.Item label="Inventory">{lookupResult.context.inventoryCount}</Descriptions.Item>
                <Descriptions.Item label="Preferences">
                  {lookupResult.context.hasPreferences ? <Tag color="green">Set</Tag> : <Tag>None</Tag>}
                </Descriptions.Item>
              </Descriptions>
              {lookupResult.feedHealth.sourceDistribution.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Source breakdown:</Text>
                  <div style={{ marginTop: 4 }}>
                    {lookupResult.feedHealth.sourceDistribution
                      .sort((a, b) => b.count - a.count)
                      .map((s) => (
                        <Tag key={s.source} color={SOURCE_COLORS[s.source] || 'default'} style={{ marginBottom: 4 }}>
                          {s.source}: {s.count}
                        </Tag>
                      ))}
                  </div>
                </div>
              )}
            </Col>
          </Row>
        )}
      </Card>

      {/* Queue Status */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            variant="outlined"
            title={
              <Space>
                <SyncOutlined />
                Distribution Queue
                <Badge status={getQueueBadge(queueStats?.distribution) as 'default' | 'success' | 'processing' | 'error' | 'warning'} />
              </Space>
            }
            loading={queueLoading}
            extra={
              <Button size="small" icon={<ReloadOutlined />} onClick={loadQueueStats}>
                Refresh
              </Button>
            }
          >
            {queueStats?.distribution && (
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="Waiting"
                    value={queueStats.distribution.waiting}
                    styles={{ content: { color: queueStats.distribution.waiting > 0 ? '#faad14' : undefined } }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Active"
                    value={queueStats.distribution.active}
                    styles={{ content: { color: queueStats.distribution.active > 0 ? '#1890ff' : undefined } }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Failed"
                    value={queueStats.distribution.failed}
                    styles={{ content: { color: queueStats.distribution.failed > 0 ? '#ff4d4f' : undefined } }}
                  />
                </Col>
              </Row>
            )}
            <div style={{ marginTop: 16 }}>
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="Completed">
                  {queueStats?.distribution.completed ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="Delayed">
                  {queueStats?.distribution.delayed ?? 0}
                </Descriptions.Item>
              </Descriptions>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            variant="outlined"
            title={
              <Space>
                <ClearOutlined />
                Cleanup Queue
                <Badge status={getQueueBadge(queueStats?.cleanup) as 'default' | 'success' | 'processing' | 'error' | 'warning'} />
              </Space>
            }
            loading={queueLoading}
            extra={
              <Tooltip title={cleanupEnabled ? 'Auto cleanup is ON' : 'Auto cleanup is OFF'}>
                <Switch
                  checkedChildren="ON"
                  unCheckedChildren="OFF"
                  checked={cleanupEnabled}
                  loading={cleanupToggleLoading}
                  onChange={handleToggleCleanup}
                />
              </Tooltip>
            }
          >
            {queueStats?.cleanup && (
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic title="Waiting" value={queueStats.cleanup.waiting} />
                </Col>
                <Col span={8}>
                  <Statistic title="Active" value={queueStats.cleanup.active} />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Failed"
                    value={queueStats.cleanup.failed}
                    styles={{ content: { color: queueStats.cleanup.failed > 0 ? '#ff4d4f' : undefined } }}
                  />
                </Col>
              </Row>
            )}
            <div style={{ marginTop: 16 }}>
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="Completed">
                  {queueStats?.cleanup.completed ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="Schedule">Daily 02:00 UTC</Descriptions.Item>
              </Descriptions>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Actions */}
      <Card variant="outlined" title="Actions" style={{ marginBottom: 16 }}>
        <Flex gap={12} wrap="wrap">
          <Popconfirm
            title="Trigger Cleanup"
            description="This will run feed cleanup immediately (removes low-score feeds)"
            onConfirm={handleTriggerCleanup}
            okText="Run Cleanup"
          >
            <Button icon={<ClearOutlined />} loading={actionLoading === 'cleanup'}>
              Manual Cleanup
            </Button>
          </Popconfirm>
          <Popconfirm
            title="Full Redistribution"
            description="Re-distribute feeds for all posts from the last 48 hours. This is resource-intensive."
            onConfirm={handleFullRedistribution}
            okText="Redistribute"
            okType="danger"
          >
            <Button
              icon={<ThunderboltOutlined />}
              loading={actionLoading === 'redistribution'}
              danger
            >
              Full Redistribution (48h)
            </Button>
          </Popconfirm>
          <Popconfirm
            title="Seed Empty Feeds"
            description="Queue feed distribution for users with no feeds (cold start fix)"
            onConfirm={handleSeedEmptyFeeds}
            okText="Seed Feeds"
          >
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={actionLoading === 'seed'}
            >
              Seed Empty Feeds
            </Button>
          </Popconfirm>
          <Button
            icon={<SendOutlined />}
            onClick={() => setDistributionModalOpen(true)}
          >
            Distribute Single Post
          </Button>
          <Popconfirm
            title="Clean Queue"
            description="Remove all waiting, completed, and failed jobs from the distribution queue"
            onConfirm={handleCleanQueue}
            okText="Clean"
            okType="danger"
          >
            <Button
              icon={<DeleteOutlined />}
              loading={actionLoading === 'clean-queue'}
              danger
              type="text"
            >
              Clean Queue
            </Button>
          </Popconfirm>
        </Flex>
      </Card>

      {/* Score Distribution & Source Distribution */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card variant="outlined" title="Score Distribution" loading={loading}>
            {stats && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <Flex justify="space-between" style={{ marginBottom: 4 }}>
                    <span>Low (&lt;10)</span>
                    <span>{stats.scoreDistribution.low.toLocaleString()}</span>
                  </Flex>
                  <Progress
                    percent={
                      stats.overview.totalFeeds > 0
                        ? Math.round(
                            (stats.scoreDistribution.low / stats.overview.totalFeeds) * 100,
                          )
                        : 0
                    }
                    strokeColor="#ff4d4f"
                    showInfo={false}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <Flex justify="space-between" style={{ marginBottom: 4 }}>
                    <span>Medium (10-30)</span>
                    <span>{stats.scoreDistribution.medium.toLocaleString()}</span>
                  </Flex>
                  <Progress
                    percent={
                      stats.overview.totalFeeds > 0
                        ? Math.round(
                            (stats.scoreDistribution.medium / stats.overview.totalFeeds) * 100,
                          )
                        : 0
                    }
                    strokeColor="#faad14"
                    showInfo={false}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <Flex justify="space-between" style={{ marginBottom: 4 }}>
                    <span>High (30-60)</span>
                    <span>{stats.scoreDistribution.high.toLocaleString()}</span>
                  </Flex>
                  <Progress
                    percent={
                      stats.overview.totalFeeds > 0
                        ? Math.round(
                            (stats.scoreDistribution.high / stats.overview.totalFeeds) * 100,
                          )
                        : 0
                    }
                    strokeColor="#52c41a"
                    showInfo={false}
                  />
                </div>
                <div>
                  <Flex justify="space-between" style={{ marginBottom: 4 }}>
                    <span>Very High (60+)</span>
                    <span>{stats.scoreDistribution.veryHigh.toLocaleString()}</span>
                  </Flex>
                  <Progress
                    percent={
                      stats.overview.totalFeeds > 0
                        ? Math.round(
                            (stats.scoreDistribution.veryHigh / stats.overview.totalFeeds) * 100,
                          )
                        : 0
                    }
                    strokeColor="#1890ff"
                    showInfo={false}
                  />
                </div>
                <div
                  style={{
                    marginTop: 16,
                    padding: '8px 12px',
                    background: 'var(--ant-color-bg-container-disabled)',
                    borderRadius: 6,
                  }}
                >
                  <Flex gap={16}>
                    <span>
                      Min: <strong>{stats.scores.min}</strong>
                    </span>
                    <span>
                      Avg: <strong>{stats.scores.average}</strong>
                    </span>
                    <span>
                      Max: <strong>{stats.scores.max}</strong>
                    </span>
                  </Flex>
                </div>
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card variant="outlined" title="Feed Source Distribution" loading={loading}>
            {stats?.sourceDistribution && stats.sourceDistribution.length > 0 ? (
              <div>
                {stats.sourceDistribution
                  .sort((a, b) => b.count - a.count)
                  .map((source) => (
                    <Flex
                      key={source.source}
                      justify="space-between"
                      align="center"
                      style={{
                        padding: '6px 0',
                        borderBottom: '1px solid var(--ant-color-border-secondary)',
                      }}
                    >
                      <Tag color={SOURCE_COLORS[source.source] || 'default'}>
                        {source.source}
                      </Tag>
                      <Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          avg: {source.avgScore}
                        </Text>
                        <strong>{source.count.toLocaleString()}</strong>
                      </Space>
                    </Flex>
                  ))}
              </div>
            ) : (
              <Empty description="No source data" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Activity Overview */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={8}>
            <Card variant="outlined" size="small">
              <Statistic
                title="Feeds Last 24h"
                value={stats.activity.feedsLast24h}
                prefix={<ClockCircleOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card variant="outlined" size="small">
              <Statistic
                title="Unseen Feeds"
                value={stats.overview.totalUnseenFeeds}
                prefix={<EyeInvisibleOutlined />}
                styles={{ content: { color: '#faad14' } }}
              />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card variant="outlined" size="small">
              <Statistic
                title="Feeds Older Than 7d"
                value={stats.activity.feedsOlderThan7d}
                prefix={<WarningOutlined />}
                styles={{
                  content: {
                    color: stats.activity.feedsOlderThan7d > 10000 ? '#ff4d4f' : undefined,
                  },
                }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Job History */}
      <Card
        variant="outlined"
        title={
          <Space>
            <HistoryOutlined />
            Recent Job History
          </Space>
        }
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={loadJobHistory}>
            Refresh
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Last 15 completed and 10 failed distribution jobs (from BullMQ)
        </Text>
        {jobHistory && jobHistory.failed.length > 0 && (
          <>
            <Text strong style={{ color: '#ff4d4f' }}>
              Failed Jobs ({jobHistory.failed.length})
            </Text>
            <Table
              columns={failedJobColumns}
              dataSource={jobHistory.failed}
              rowKey="id"
              loading={jobHistoryLoading}
              pagination={false}
              size="small"
              style={{ marginTop: 8, marginBottom: 16 }}
            />
          </>
        )}
        <Text strong>Completed Jobs ({jobHistory?.completed.length ?? 0})</Text>
        <Table
          columns={jobColumns}
          dataSource={jobHistory?.completed ?? []}
          rowKey="id"
          loading={jobHistoryLoading}
          pagination={false}
          size="small"
          style={{ marginTop: 8 }}
          locale={{ emptyText: <Empty description="No completed jobs" /> }}
        />
      </Card>

      {/* Empty Feed Users */}
      <Card
        variant="outlined"
        title={
          <Space>
            <UserOutlined />
            Users with Empty Feeds
            {emptyFeedTotal > 0 && <Tag color="red">{emptyFeedTotal}</Tag>}
          </Space>
        }
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => loadEmptyFeedUsers(1)}
          >
            Refresh
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        {emptyFeedTotal > 0 && (
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            description={`${emptyFeedTotal} active users have empty feeds (cold start problem). Use 'Seed Empty Feeds' to fix.`}
            style={{ marginBottom: 16 }}
          />
        )}
        <Table
          columns={emptyFeedColumns}
          dataSource={emptyFeedUsers}
          rowKey="id"
          loading={emptyLoading}
          pagination={{
            current: emptyFeedPage,
            pageSize: 10,
            total: emptyFeedTotal,
            showSizeChanger: false,
            showTotal: (total) => `${total} users`,
            onChange: loadEmptyFeedUsers,
          }}
          locale={{
            emptyText: (
              <Empty
                description={
                  <Space>
                    <CheckCircleOutlined /> All users have feeds
                  </Space>
                }
              />
            ),
          }}
          size="small"
        />
      </Card>

      {/* Scoring Algorithm Config (Coming Soon) */}
      <Card
        variant="outlined"
        title={
          <Space>
            <ToolOutlined />
            Scoring Algorithm Weights
            <Tag color="blue">Coming Soon</Tag>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          icon={<LockOutlined />}
          description="Scoring weight tuning from admin panel is coming soon. Below are the current hardcoded weights for reference."
          style={{ marginBottom: 16 }}
        />
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8}>
            <Card size="small" title="Trust Scoring (max 40pts)">
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Mutual Trust">{scoringWeights.trust.mutual}</Descriptions.Item>
                <Descriptions.Item label="User Trusts Author">{scoringWeights.trust.userTrustsAuthor}</Descriptions.Item>
                <Descriptions.Item label="Author Trusts User">{scoringWeights.trust.authorTrustsUser}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card size="small" title="Inventory Scoring (max 30pts)">
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Exact Product">{scoringWeights.inventory.exactProduct}</Descriptions.Item>
                <Descriptions.Item label="Product Group">{scoringWeights.inventory.productGroup}</Descriptions.Item>
                <Descriptions.Item label="Category Match">{scoringWeights.inventory.categoryMatch}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card size="small" title="Other Factors">
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="Trending Bonus">{scoringWeights.engagement.trending}</Descriptions.Item>
                <Descriptions.Item label="High Engagement">{scoringWeights.engagement.highEngagement}</Descriptions.Item>
                <Descriptions.Item label="Recency (48h)">{scoringWeights.recency.hours48}</Descriptions.Item>
                <Descriptions.Item label="Boost (max)">{scoringWeights.boost.max}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Distribute Single Post Modal */}
      <Modal
        title="Distribute Single Post"
        open={distributionModalOpen}
        onCancel={() => {
          setDistributionModalOpen(false);
          setDistributionPostId('');
        }}
        onOk={handleDistributeSinglePost}
        okText="Distribute"
        confirmLoading={actionLoading === 'distribute-single'}
        okButtonProps={{ disabled: !distributionPostId.trim() }}
      >
        <p style={{ marginBottom: 12, color: 'var(--ant-color-text-secondary)' }}>
          Enter a post ID to re-run feed distribution with full scoring for all active users.
        </p>
        <Input
          placeholder="Post ID (ULID)"
          value={distributionPostId}
          onChange={(e) => setDistributionPostId(e.target.value)}
          onPressEnter={handleDistributeSinglePost}
        />
      </Modal>
    </div>
  );
}

export default FeedManagement;
