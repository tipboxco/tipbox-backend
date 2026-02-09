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
  Spin,
  Empty,
  Alert,
  Image,
  Button,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { TrophyOutlined, SearchOutlined, TagOutlined, StarOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  fetchBadgesStats,
  fetchBadges,
} from '../../api/admin-badges-collections';
import type { AdminBadgeListItem, AdminBadgeStatsResponse } from '../../types/admin';

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
        if (!cancelled) setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
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
      title: 'Görsel',
      dataIndex: 'imageUrl',
      key: 'image',
      width: 80,
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
      title: 'Ad',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Tip',
      dataIndex: 'type',
      key: 'type',
      width: 120,
    },
    {
      title: 'Rarity',
      dataIndex: 'rarity',
      key: 'rarity',
      width: 100,
    },
    {
      title: 'Kategori',
      key: 'category',
      width: 120,
      render: (_, record) => record.categoryName ?? record.categoryId,
    },
    {
      title: 'Koleksiyon',
      key: 'collection',
      width: 150,
      render: (_, record) => record.collectionName ?? (record.collectionId ? '—' : '—'),
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
        <Link to={`/gamification/badges/${record.id}`}>
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
        title="Badges"
        description="Badge listesi, filtreleme ve yönetim"
        icon={<TrophyOutlined />}
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
                  title="Toplam"
                  value={stats.total}
                  prefix={<TrophyOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                />
              </Card>
            </Col>
            {Object.entries(stats.byType || {}).map(([t, count]) => (
              <Col xs={24} sm={12} lg={6} key={t}>
                <Card bordered>
                  <Statistic
                    title={t}
                    value={count}
                    prefix={<TagOutlined />}
                    valueStyle={{ fontWeight: 600 }}
                  />
                </Card>
              </Col>
            ))}
            {Object.entries(stats.byRarity || {}).map(([r, count]) => (
              <Col xs={24} sm={12} lg={6} key={r}>
                <Card bordered>
                  <Statistic
                    title={r}
                    value={count}
                    prefix={<StarOutlined />}
                    valueStyle={{ fontWeight: 600 }}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )
      )}

      {/* Badge List */}
      <Card
        bordered
        title="Badge listesi"
        extra={
          <Space wrap>
            <Input
              placeholder="Ara (ad, açıklama)"
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
              placeholder="Tüm tipler"
            >
              <Select.Option value="">Tüm tipler</Select.Option>
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
              placeholder="Tüm rarity"
            >
              <Select.Option value="">Tüm rarity</Select.Option>
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
          dataSource={badges}
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
                description="Badge bulunamadı. Filtreleri değiştirin veya yeni badge oluşturun."
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default Badges;
