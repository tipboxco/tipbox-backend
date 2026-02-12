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
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { FolderOpenOutlined, SearchOutlined, PlusOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import type { StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import CreateCollectionModal from './CreateCollectionModal';
import {
  fetchCollectionsStats,
  fetchCollections,
} from '../../api/admin-badges-collections';
import type { AdminCollectionListItem, AdminCollectionStatsResponse } from '../../types/admin';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function BadgeCollections() {
  const [stats, setStats] = useState<AdminCollectionStatsResponse | null>(null);
  const [collections, setCollections] = useState<AdminCollectionListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'createdAt' | 'name'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCollectionsStats();
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
  }, [refreshTrigger]);

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    (async () => {
      try {
        const res = await fetchCollections({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          search: search || undefined,
          sort,
          order,
        });
        if (!cancelled) {
          setCollections(res.data ?? []);
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
  }, [pagination.offset, search, sort, order, refreshTrigger]);

  const columns: ColumnsType<AdminCollectionListItem> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE - 50,
      ellipsis: true,
      render: (name) => name ?? '—',
    },
    {
      title: 'Category',
      key: 'category',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (_, record) => {
        // If no category assigned, show "Custom"
        if (!record.categoryId && !record.categoryName) {
          return 'Custom';
        }
        return record.categoryName ?? record.categoryId ?? '—';
      },
    },
    {
      title: 'Badge count',
      dataIndex: 'badgesCount',
      key: 'badgesCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      ellipsis: true,
    },
    {
      title: 'Goal count',
      dataIndex: 'goalsCount',
      key: 'goalsCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      ellipsis: true,
      render: (count) => count ?? 0,
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
      render: (_, record) => <ViewActionButton to={`/gamification/collections/${record.id}`} />,
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
          label: 'Total Collections',
          value: stats.total,
          icon: <FolderOpenOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Collections"
        description="Collection list, filtering and management (achievement badges are managed within collections)"
        icon={<FolderOpenOutlined />}
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

      {/* Collection List */}
      <Card
        bordered
        title="Collection list"
        extra={
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              New collection
            </Button>
            <Input
              placeholder="Search (name)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              prefix={<SearchOutlined />}
              style={{ width: 150 }}
              allowClear
            />
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
          dataSource={collections}
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
                description="No collections found. Change filters or create a new collection."
              />
            ),
          }}
        />
      </Card>

      <CreateCollectionModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => setRefreshTrigger((t) => t + 1)}
      />
    </div>
  );
}

export default BadgeCollections;
