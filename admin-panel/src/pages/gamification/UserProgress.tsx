import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Input, Select, Space, Tag, Progress, message as antdMessage } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  LineChartOutlined,
  TrophyOutlined,
  UserOutlined,
  SearchOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import type { StatItemData } from '../../components/StatItem';
import {
  fetchUserProgressStats,
  fetchUserProgressList,
} from '../../api/admin-gamification';
import type {
  UserProgressStatsResponse,
  AdminUserProgressListItem,
} from '../../api/admin-gamification';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';
import { BADGE_COLOR_PRIMARY } from '../../constants/badge-colors';

const PAGE_SIZE = 20;

function UserProgress() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserProgressStatsResponse | null>(null);
  const [progressList, setProgressList] = useState<AdminUserProgressListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [claimStatus, setClaimStatus] = useState<'all' | 'claimed' | 'unclaimed'>('all');
  const [sortOrder, setSortOrder] = useState<string>('lastActivity-desc');

  // Fetch stats
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchUserProgressStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to load stats', e);
          antdMessage.error('Failed to load statistics');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch progress list
  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    (async () => {
      try {
        const [sort, order] = sortOrder.split('-') as [
          'username' | 'totalBadges' | 'progressPercent' | 'lastActivity',
          'asc' | 'desc'
        ];
        const res = await fetchUserProgressList({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          search: search || undefined,
          claimStatus,
          sort,
          order,
        });
        if (!cancelled) {
          setProgressList(res.data ?? []);
          if (res.pagination) setPagination((prev) => ({ ...prev, ...res.pagination }));
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to load list', e);
          antdMessage.error('Failed to load user progress data');
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset, search, claimStatus, sortOrder]);

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Users',
          value: stats.totalUsers,
          icon: <UserOutlined />,
        },
        {
          label: 'Users with Badges',
          value: stats.totalUsersWithBadges,
          icon: <TrophyOutlined />,
          valueColor: BADGE_COLOR_PRIMARY,
        },
        {
          label: 'Avg Badges/User',
          value: stats.averageBadgesPerUser,
          icon: <TrophyOutlined />,
        },
        {
          label: 'Active Users (30d)',
          value: stats.activeUsers,
          icon: <RiseOutlined />,
          valueColor: '#52c41a',
        },
      ]
    : undefined;

  const columns: ColumnsType<AdminUserProgressListItem> = [
    {
      title: 'User',
      key: 'user',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      ellipsis: true,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {record.userName || record.displayName || '—'}
          </div>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{record.email}</div>
        </div>
      ),
    },
    {
      title: 'Total Badges',
      dataIndex: 'totalBadges',
      key: 'totalBadges',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (count: number) => (
        <Tag color={count > 0 ? BADGE_COLOR_PRIMARY : 'default'}>{count}</Tag>
      ),
    },
    {
      title: 'Claimed',
      dataIndex: 'claimedBadges',
      key: 'claimedBadges',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (count: number) => <Tag color={count > 0 ? '#52c41a' : 'default'}>{count}</Tag>,
    },
    {
      title: 'Unclaimed',
      dataIndex: 'unclaimedBadges',
      key: 'unclaimedBadges',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (count: number) => <Tag color={count > 0 ? '#faad14' : 'default'}>{count}</Tag>,
    },
    {
      title: 'Achievements',
      key: 'achievements',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      render: (_, record) => (
        <div style={{ fontSize: '12px' }}>
          {record.completedAchievements} / {record.totalAchievements}
        </div>
      ),
    },
    {
      title: 'Progress',
      dataIndex: 'progressPercent',
      key: 'progressPercent',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT + 20,
      render: (percent: number) => (
        <Progress
          percent={percent}
          size="small"
          strokeColor={percent >= 75 ? '#52c41a' : percent >= 50 ? '#1890ff' : '#faad14'}
        />
      ),
    },
    {
      title: 'Last Activity',
      dataIndex: 'lastActivity',
      key: 'lastActivity',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      render: (date: string | null) =>
        date ? new Date(date).toLocaleDateString('en-US') : '—',
    },
  ];

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    setPagination((prev) => ({
      ...prev,
      offset: ((newPagination.current ?? 1) - 1) * PAGE_SIZE,
    }));
  };

  return (
    <div>
      <PageHeader
        title="User Progress"
        description="Track user achievement progress and badge ownership"
        icon={<LineChartOutlined />}
        stats={statsData}
        statsLoading={loading}
      />

      <Card
        bordered
        title="User Progress Management"
        extra={
          <Space wrap>
            <Input
              placeholder="Search users..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              value={claimStatus}
              onChange={(value) => {
                setClaimStatus(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 150 }}
            >
              <Select.Option value="all">All Users</Select.Option>
              <Select.Option value="claimed">Has Claimed</Select.Option>
              <Select.Option value="unclaimed">Has Unclaimed</Select.Option>
            </Select>
            <Select
              value={sortOrder}
              onChange={(value) => {
                setSortOrder(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 180 }}
            >
              <Select.Option value="lastActivity-desc">Recent Activity</Select.Option>
              <Select.Option value="totalBadges-desc">Most Badges</Select.Option>
              <Select.Option value="progressPercent-desc">Highest Progress</Select.Option>
              <Select.Option value="username-asc">Username A-Z</Select.Option>
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={progressList}
          loading={loadingList}
          rowKey="userId"
          pagination={{
            current: pagination.offset / PAGE_SIZE + 1,
            pageSize: PAGE_SIZE,
            total: pagination.total,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} users`,
          }}
          onChange={handleTableChange}
          onRow={(record) => ({
            onClick: () => navigate(`/users/${record.userId}`),
            style: { cursor: 'pointer' },
          })}
          scroll={TABLE_SCROLL_CONFIGS.AUTO}
        />
      </Card>
    </div>
  );
}

export default UserProgress;
