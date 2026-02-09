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
  Button,
  Space,
  Spin,
  Empty,
  Alert,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { FolderOpenOutlined, SearchOutlined, PlusOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCollectionsStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'İstatistikler yüklenemedi');
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
        if (!cancelled) setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset, search, sort, order]);

  const columns: ColumnsType<AdminCollectionListItem> = [
    {
      title: 'Ad',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Kategori',
      key: 'category',
      render: (_, record) => record.categoryName ?? record.categoryId,
    },
    {
      title: 'Badge sayısı',
      dataIndex: 'badgesCount',
      key: 'badgesCount',
      width: 120,
      align: 'right',
    },
    {
      title: 'Hedef sayısı',
      dataIndex: 'goalsCount',
      key: 'goalsCount',
      width: 120,
      align: 'right',
      render: (count) => count ?? 0,
    },
    {
      title: 'Oluşturulma',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date) => new Date(date).toLocaleString('tr-TR'),
    },
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Link to={`/gamification/collections/${record.id}`}>
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
        title="Collections"
        description="Koleksiyon listesi, filtreleme ve yönetim (achievement badge'ler koleksiyon içinde yönetilir)"
        icon={<FolderOpenOutlined />}
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
                  title="Toplam koleksiyon"
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
        title="Koleksiyon listesi"
        extra={
          <Space wrap>
            <Link to="/gamification/collections/new">
              <Button type="primary" icon={<PlusOutlined />}>
                Yeni koleksiyon
              </Button>
            </Link>
            <Input
              placeholder="Ara (ad)"
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
              <Select.Option value="createdAt">Oluşturulma</Select.Option>
              <Select.Option value="name">Ad</Select.Option>
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
          dataSource={collections}
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
                description="Koleksiyon bulunamadı. Filtreleri değiştirin veya yeni koleksiyon oluşturun."
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default BadgeCollections;
