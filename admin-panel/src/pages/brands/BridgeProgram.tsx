import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Space,
  Tag,
  Empty,
  Alert,
  Row,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  LinkOutlined,
  SearchOutlined,
  LockOutlined,
  UnlockOutlined,
  LikeOutlined,
  CommentOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchBridgeStats,
  fetchBridgePosts,
} from '../../api/admin-brands';
import type {
  AdminBridgeStatsResponse,
  AdminBridgePostListItem,
} from '../../api/admin-brands';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function BridgeProgram() {
  const [stats, setStats] = useState<AdminBridgeStatsResponse | null>(null);
  const [posts, setPosts] = useState<AdminBridgePostListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchBridgeStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load statistics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPosts = async () => {
    setLoadingList(true);
    try {
      const res = await fetchBridgePosts({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
      });
      setPosts(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bridge posts');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search]);

  const columns: ColumnsType<AdminBridgePostListItem> = [
    {
      title: 'Brand',
      dataIndex: 'brandName',
      key: 'brandName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
    },
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.userEmail ?? '—',
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
    },
    {
      title: 'Access',
      dataIndex: 'followerOnly',
      key: 'followerOnly',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (followerOnly) =>
        followerOnly ? (
          <Tag icon={<LockOutlined />} color="orange">
            Followers Only
          </Tag>
        ) : (
          <Tag icon={<UnlockOutlined />} color="green">
            Public
          </Tag>
        ),
    },
    {
      title: 'Likes',
      dataIndex: 'likeCount',
      key: 'likeCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (count) => count ?? 0,
    },
    {
      title: 'Comments',
      dataIndex: 'commentCount',
      key: 'commentCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (count) => count ?? 0,
    },
    {
      title: 'Views',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (count) => count ?? 0,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_SINGLE,
      render: (_, record) => <ViewActionButton to={`/content/posts/${record.id}`} />,
    },
  ];

  const handleTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * PAGE_SIZE;
    setPagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Followers',
          value: stats.totalFollowers,
          icon: <LinkOutlined />,
        },
        {
          label: 'Total Posts',
          value: stats.totalPosts,
          icon: <LinkOutlined />,
        },
        {
          label: 'Active Brands',
          value: stats.activeBrands,
          icon: <LinkOutlined />,
        },
        {
          label: 'Avg Followers',
          value: stats.avgFollowersPerBrand ?? '—',
          icon: <LinkOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Bridge Program"
        description="Manage brand community engagement"
        icon={<LinkOutlined />}
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

      <Card bordered={false}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Input
              placeholder="Search bridge posts..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
          </Row>

          <Table
            columns={columns}
            dataSource={posts}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} posts`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No bridge posts found" />,
            }}
          />
        </Space>
      </Card>
    </div>
  );
}

export default BridgeProgram;
