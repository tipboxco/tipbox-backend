import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  Table,
  Input,
  Select,
  Space,
  Tag,
  Empty,
  Alert,
  Image,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  FileTextOutlined,
  FireOutlined,
  CalendarOutlined,
  TagsOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import type { StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchContentPostsStats,
  fetchContentPosts,
} from '../../api/admin-content';
import type {
  AdminContentPostsStatsResponse,
  AdminContentPostListItem,
} from '../../types/admin';
import { BADGE_COLOR_PRIMARY } from '../../constants/badge-colors';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

const POST_TYPES = [
  { value: '', label: 'All types' },
  { value: 'FREE', label: 'FREE' },
  { value: 'TIPS', label: 'TIPS' },
  { value: 'COMPARE', label: 'COMPARE' },
  { value: 'QUESTION', label: 'QUESTION' },
  { value: 'EXPERIENCE', label: 'EXPERIENCE' },
  { value: 'UPDATE', label: 'UPDATE' },
];

type SortField = 'createdAt' | 'likesCount' | 'commentsCount' | 'viewsCount' | 'title';

function ContentPosts() {
  const [stats, setStats] = useState<AdminContentPostsStatsResponse | null>(null);
  const [posts, setPosts] = useState<AdminContentPostListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('');
  const [sort, setSort] = useState<SortField>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchContentPostsStats();
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

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    (async () => {
      try {
        const res = await fetchContentPosts({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          search: search || undefined,
          type: type || undefined,
          sort,
          order,
        });
        if (!cancelled) {
          setPosts(res.data ?? []);
          if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load list');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset, search, type, sort, order]);

  const userDisplay = (p: AdminContentPostListItem) =>
    p.userDisplayName || p.userName || p.userId?.slice(0, 8) || '—';

  const titleDisplay = (p: AdminContentPostListItem) =>
    (p.title && p.title.trim()) || (p.bodyExcerpt && p.bodyExcerpt.trim().slice(0, 80)) || '—';

  const columns: ColumnsType<AdminContentPostListItem> = [
    {
      title: 'Image',
      dataIndex: 'thumbnailUrl',
      key: 'thumbnail',
      width: TABLE_COLUMN_WIDTHS.IMAGE_SMALL,
      ellipsis: false,
      render: (url) =>
        url ? (
          <Image
            src={url}
            alt=""
            width={60}
            height={60}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            preview={false}
          />
        ) : (
          <div
            style={{
              width: 60,
              height: 60,
              background: '#f0f0f0',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            —
          </div>
        ),
    },
    {
      title: 'Title',
      key: 'title',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      ellipsis: true,
      render: (_, record) => titleDisplay(record),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      ellipsis: true,
      render: (type) => <Tag color={BADGE_COLOR_PRIMARY}>{type}</Tag>,
    },
    {
      title: 'Author',
      key: 'user',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (_, record) => (
        <Link
          to={`/users/${record.userId}`}
          style={{ color: 'var(--tipbox-badge-outline)', textDecoration: 'underline' }}
        >
          {userDisplay(record)}
        </Link>
      ),
    },
    {
      title: 'Likes',
      dataIndex: 'likesCount',
      key: 'likesCount',
      width: TABLE_COLUMN_WIDTHS.NUMBER_SMALL,
      align: 'right',
      ellipsis: true,
    },
    {
      title: 'Comments',
      dataIndex: 'commentsCount',
      key: 'commentsCount',
      width: TABLE_COLUMN_WIDTHS.NUMBER_MEDIUM,
      align: 'right',
      ellipsis: true,
    },
    {
      title: 'Boosted',
      dataIndex: 'isBoosted',
      key: 'isBoosted',
      width: TABLE_COLUMN_WIDTHS.NUMBER_SMALL,
      ellipsis: true,
      render: (boosted) => (boosted ? 'Yes' : '—'),
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
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON,
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
          label: 'Total',
          value: stats.total,
          icon: <FileTextOutlined />,
        },
        {
          label: 'Boosted',
          value: stats.boostedCount,
          icon: <FireOutlined />,
          valueColor: '#8B9D2D',
        },
        {
          label: 'With Event',
          value: stats.withEventCount,
          icon: <CalendarOutlined />,
        },
        {
          label: 'By Type',
          value: Object.keys(stats.byType).length,
          icon: <TagsOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="All Posts"
        description="Manage user-generated content posts"
        icon={<FileTextOutlined />}
        stats={statsData}
        statsLoading={loading}
      />

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Post List Table */}
      <Card
        bordered
        title="Post list"
        extra={
          <Space wrap>
            <Input
              placeholder="Search (title, content)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              value={type}
              onChange={(value) => {
                setType(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 140 }}
              placeholder="All types"
            >
              {POST_TYPES.map((opt) => (
                <Select.Option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
            <Select
              value={sort}
              onChange={(value) => {
                setSort(value as SortField);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 130 }}
            >
              <Select.Option value="createdAt">Created</Select.Option>
              <Select.Option value="likesCount">Likes</Select.Option>
              <Select.Option value="commentsCount">Comments</Select.Option>
              <Select.Option value="viewsCount">Views</Select.Option>
              <Select.Option value="title">Title</Select.Option>
            </Select>
            <Select
              value={order}
              onChange={(value) => {
                setOrder(value as 'asc' | 'desc');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 100 }}
            >
              <Select.Option value="desc">Descending</Select.Option>
              <Select.Option value="asc">Ascending</Select.Option>
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={posts}
          rowKey="id"
          loading={loadingList}
          scroll={TABLE_SCROLL_CONFIGS.AUTO}
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total: pagination.total,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} records`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No posts found"
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default ContentPosts;
