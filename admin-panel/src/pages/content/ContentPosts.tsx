import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Input,
  Select,
  Space,
  Tag,
  Button,
  Spin,
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
import {
  fetchContentPostsStats,
  fetchContentPosts,
} from '../../api/admin-content';
import type {
  AdminContentPostsStatsResponse,
  AdminContentPostListItem,
} from '../../types/admin';

const PAGE_SIZE = 20;

const POST_TYPES = [
  { value: '', label: 'Tüm türler' },
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
          setError(e instanceof Error ? e.message : 'İstatistikler yüklenemedi');
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
          setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset, search, type, sort, order]);

  const getTypeColor = (t: string) => {
    const map: Record<string, string> = {
      FREE: 'default',
      TIPS: 'gold',
      EXPERIENCE: 'blue',
      QUESTION: 'purple',
      COMPARE: 'cyan',
      UPDATE: 'green',
    };
    return map[t] ?? 'default';
  };

  const userDisplay = (p: AdminContentPostListItem) =>
    p.userDisplayName || p.userName || p.userId?.slice(0, 8) || '—';

  const titleDisplay = (p: AdminContentPostListItem) =>
    (p.title && p.title.trim()) || (p.bodyExcerpt && p.bodyExcerpt.trim().slice(0, 80)) || '—';

  const columns: ColumnsType<AdminContentPostListItem> = [
    {
      title: 'Görsel',
      dataIndex: 'thumbnailUrl',
      key: 'thumbnail',
      width: 80,
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
      title: 'Başlık',
      key: 'title',
      ellipsis: true,
      render: (_, record) => titleDisplay(record),
    },
    {
      title: 'Tür',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => <Tag color={getTypeColor(type)}>{type}</Tag>,
    },
    {
      title: 'Yazar',
      key: 'user',
      width: 150,
      render: (_, record) => (
        <Link to={`/users/${record.userId}`}>
          <Button type="link" size="small" style={{ padding: 0 }}>
            {userDisplay(record)}
          </Button>
        </Link>
      ),
    },
    {
      title: 'Beğeni',
      dataIndex: 'likesCount',
      key: 'likesCount',
      width: 80,
      align: 'right',
    },
    {
      title: 'Yorum',
      dataIndex: 'commentsCount',
      key: 'commentsCount',
      width: 80,
      align: 'right',
    },
    {
      title: 'Boosted',
      dataIndex: 'isBoosted',
      key: 'isBoosted',
      width: 90,
      render: (boosted) => (boosted ? 'Evet' : '—'),
    },
    {
      title: 'Oluşturulma',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => (date ? new Date(date).toLocaleDateString('tr-TR') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Link to={`/content/posts/${record.id}`}>
          <Button type="link" size="small">
            Detay
          </Button>
        </Link>
      ),
    },
  ];

  const handleTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * PAGE_SIZE;
    setPagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div>
      <PageHeader
        title="All Posts"
        description="Manage user-generated content posts"
        icon={<FileTextOutlined />}
      />

      {error && (
        <Alert
          message="Hata"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Stats Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        stats && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Toplam"
                  value={stats.total}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Boosted"
                  value={stats.boostedCount}
                  prefix={<FireOutlined />}
                  valueStyle={{ fontWeight: 700, color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Event'e bağlı"
                  value={stats.withEventCount}
                  prefix={<CalendarOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Türe göre"
                  value={Object.keys(stats.byType).length}
                  prefix={<TagsOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                />
              </Card>
            </Col>
          </Row>
        )
      )}

      {/* Post List Table */}
      <Card
        bordered
        title="Post listesi"
        extra={
          <Space wrap>
            <Input
              placeholder="Ara (başlık, içerik)"
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
              placeholder="Tüm türler"
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
              <Select.Option value="createdAt">Oluşturulma</Select.Option>
              <Select.Option value="likesCount">Beğeni</Select.Option>
              <Select.Option value="commentsCount">Yorum</Select.Option>
              <Select.Option value="viewsCount">Görüntülenme</Select.Option>
              <Select.Option value="title">Başlık</Select.Option>
            </Select>
            <Select
              value={order}
              onChange={(value) => {
                setOrder(value as 'asc' | 'desc');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 100 }}
            >
              <Select.Option value="desc">Azalan</Select.Option>
              <Select.Option value="asc">Artan</Select.Option>
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={posts}
          rowKey="id"
          loading={loadingList}
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total: pagination.total,
            showSizeChanger: false,
            showTotal: (total) => `Toplam ${total} kayıt`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Post bulunamadı"
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default ContentPosts;
