import { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Input,
  Select,
  Button,
  Space,
  Spin,
  Empty,
  Alert,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { FolderOpenOutlined, SearchOutlined, PlusOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import ViewActionButton from '../../components/ViewActionButton';
import CreateCollectionModal from './CreateCollectionModal';
import {
  fetchCollectionsStats,
  fetchCollections,
} from '../../api/admin-badges-collections';
import type { AdminCollectionListItem, AdminCollectionStatsResponse } from '../../types/admin';

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
      ellipsis: true,
      render: (name) => name ?? '—',
    },
    {
      title: 'Category',
      key: 'category',
      width: 140,
      ellipsis: true,
      render: (_, record) => record.categoryName ?? record.categoryId ?? '—',
    },
    {
      title: 'Badge count',
      dataIndex: 'badgesCount',
      key: 'badgesCount',
      width: 100,
      align: 'right',
      ellipsis: true,
    },
    {
      title: 'Goal count',
      dataIndex: 'goalsCount',
      key: 'goalsCount',
      width: 100,
      align: 'right',
      ellipsis: true,
      render: (count) => count ?? 0,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      ellipsis: true,
      render: (date) => new Date(date).toLocaleString('en-US'),
    },
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_, record) => <ViewActionButton to={`/gamification/collections/${record.id}`} />,
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
        title="Collections"
        description="Collection list, filtering and management (achievement badges are managed within collections)"
        icon={<FolderOpenOutlined />}
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

      {/* Stats */}
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
                  title="Total collections"
                  value={stats.total}
                  prefix={<FolderOpenOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                />
              </Card>
            </Col>
          </Row>
        )
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
