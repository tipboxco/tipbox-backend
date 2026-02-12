import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Select,
  Button,
  Space,
  Empty,
  Alert,
  Image,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { TrophyOutlined, SearchOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import type { StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import { fetchBadges } from '../../api/admin-badges-collections';
import type { AdminBadgeListItem } from '../../types/admin';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

export type BadgeTypeSlug = 'EVENT' | 'BRAND' | 'COSMETIC';

export interface BadgeListByTypeProps {
  badgeType: BadgeTypeSlug;
  listPath: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  onOpenCreate?: () => void;
  stats?: StatItemData[];
  statsLoading?: boolean;
}

function BadgeListByType({
  badgeType,
  listPath,
  title,
  description,
  icon = <TrophyOutlined />,
  onOpenCreate,
  stats,
  statsLoading,
}: BadgeListByTypeProps) {
  const [badges, setBadges] = useState<AdminBadgeListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState<string>('');
  const [sort, setSort] = useState<'createdAt' | 'name'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    (async () => {
      try {
        const res = await fetchBadges({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          search: search || undefined,
          type: badgeType,
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
  }, [badgeType, pagination.offset, search, rarity, sort, order]);

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
      title: 'Rarity',
      dataIndex: 'rarity',
      key: 'rarity',
      width: TABLE_COLUMN_WIDTHS.NUMBER_MEDIUM,
      ellipsis: true,
    },
    {
      title: 'Category',
      key: 'category',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (_, record) => record.categoryName ?? record.categoryId,
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
      render: (_, record) => <ViewActionButton to={`${listPath}/${record.id}`} />,
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
        title={title}
        description={description}
        icon={icon}
        stats={stats}
        statsLoading={statsLoading}
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

      <Card
        bordered
        title={`${title} list`}
        extra={
          <Space wrap>
            {onOpenCreate && (
              <Button type="primary" onClick={onOpenCreate}>
                New badge
              </Button>
            )}
            <Input
              placeholder="Search (name, description)"
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

export default BadgeListByType;
