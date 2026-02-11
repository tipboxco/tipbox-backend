import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Select,
  Space,
  Empty,
  Alert,
  Image,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { TrophyOutlined, SearchOutlined, TagOutlined, StarOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import type { StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchBadgesStats,
  fetchBadges,
} from '../../api/admin-badges-collections';
import type { AdminBadgeListItem, AdminBadgeStatsResponse } from '../../types/admin';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function Badges() {
  const [stats, setStats] = useState<AdminBadgeStatsResponse | null>(null);
  const [badges, setBadges] = useState<AdminBadgeListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('');
  const [rarity, setRarity] = useState<string>('');
  const [sort, setSort] = useState<'createdAt' | 'name'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchBadgesStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load statistics');
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
        const res = await fetchBadges({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          search: search || undefined,
          type: type || undefined,
          rarity: rarity || undefined,
          sort,
          order,
        });
        if (!cancelled) {
          setBadges(res.data ?? []);
          if (res.pagination) setPagination((prev) => ({ ...prev, ...res.pagination }));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load list');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset, search, type, rarity, sort, order]);

  const columns: ColumnsType<AdminBadgeListItem> = [
    {
      title: 'Image',
      dataIndex: 'imageUrl',
      key: 'image',
      width: TABLE_COLUMN_WIDTHS.IMAGE_SMALL,
      render: (url) =>
        url ? (
          <Image
            src={url}
            alt=""
            width={48}
            height={48}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            preview={false}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
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
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE - 50,
      ellipsis: true,
      render: (name) => name ?? '—',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      ellipsis: true,
    },
    {
      title: 'Rarity',
      dataIndex: 'rarity',
      key: 'rarity',
      width: TABLE_COLUMN_WIDTHS.NUMBER_MEDIUM,
      ellipsis: true,
    },
    {
      title: 'Category',
      key: 'category',
      width: 120,
      ellipsis: true,
      render: (_, record) => record.categoryName ?? record.categoryId,
    },
    {
      title: 'Collection',
      key: 'collection',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (_, record) => record.collectionName ?? (record.collectionId ? '—' : '—'),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATETIME_FULL,
      ellipsis: true,
      render: (date) => new Date(date).toLocaleString('en-US'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON,
      render: (_, record) => <ViewActionButton to={`/gamification/badges/${record.id}`} />,
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
          icon: <TrophyOutlined />,
        },
        ...Object.entries(stats.byType || {})
          .slice(0, 3)
          .map(([type, count]) => ({
            label: type,
            value: count,
            icon: <TagOutlined />,
          })),
        ...Object.entries(stats.byRarity || {})
          .slice(0, 2)
          .map(([rarity, count]) => ({
            label: rarity,
            value: count,
            icon: <StarOutlined />,
          })),
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Badges"
        description="Badge list, filtering and management"
        icon={<TrophyOutlined />}
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

      {/* Badge List */}
      <Card
        bordered
        title="Badge list"
        extra={
          <Space wrap>
            <Input
              placeholder="Search (name, description)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              prefix={<SearchOutlined />}
              style={{ width: 180 }}
              allowClear
            />
            <Select
              value={type}
              onChange={(value) => {
                setType(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 130 }}
              placeholder="All types"
            >
              <Select.Option value="">All types</Select.Option>
              <Select.Option value="COLLECTION">COLLECTION</Select.Option>
              <Select.Option value="EVENT">EVENT</Select.Option>
              <Select.Option value="COSMETIC">COSMETIC</Select.Option>
              <Select.Option value="BRAND">BRAND</Select.Option>
            </Select>
            <Select
              value={rarity}
              onChange={(value) => {
                setRarity(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 120 }}
              placeholder="All rarity"
            >
              <Select.Option value="">All rarity</Select.Option>
              <Select.Option value="COMMON">COMMON</Select.Option>
              <Select.Option value="RARE">RARE</Select.Option>
              <Select.Option value="EPIC">EPIC</Select.Option>
            </Select>
            <Select
              value={sort}
              onChange={(value) => {
                setSort(value as 'createdAt' | 'name');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 120 }}
            >
              <Select.Option value="createdAt">Created</Select.Option>
              <Select.Option value="name">Name</Select.Option>
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
          dataSource={badges}
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
                description="No badges found. Change filters or create a new badge."
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default Badges;
