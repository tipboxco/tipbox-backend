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
  Tag,
  Button,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  CalendarOutlined,
  FileOutlined,
  SignalFilled,
  InboxOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { fetchEventsStats, fetchEvents } from '../../api/admin-events';
import type { AdminEventListItem, AdminEventStatsResponse } from '../../types/admin';

const PAGE_SIZE = 20;

function EventList() {
  const [stats, setStats] = useState<AdminEventStatsResponse | null>(null);
  const [events, setEvents] = useState<AdminEventListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [feedType, setFeedType] = useState<string>('');
  const [sort, setSort] = useState<'createdAt' | 'startDate' | 'endDate' | 'title'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchEventsStats();
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
        const res = await fetchEvents({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          search: search || undefined,
          status: status || undefined,
          feedType: feedType || undefined,
          sort,
          order,
        });
        if (!cancelled) {
          setEvents(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
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
  }, [pagination.offset, search, status, feedType, sort, order]);

  const columns: ColumnsType<AdminEventListItem> = [
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
      title: 'Başlık',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Durum',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const colorMap: Record<string, string> = {
          DRAFT: 'default',
          PUBLISHED: 'success',
          CLOSED: 'error',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: 'Feed',
      dataIndex: 'feedType',
      key: 'feedType',
      width: 100,
    },
    {
      title: 'Başlangıç',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 120,
      render: (date) => (date ? new Date(date).toLocaleDateString('tr-TR') : '—'),
    },
    {
      title: 'Bitiş',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 120,
      render: (date) => (date ? new Date(date).toLocaleDateString('tr-TR') : '—'),
    },
    {
      title: 'Katılımcı',
      dataIndex: 'participantsCount',
      key: 'participantsCount',
      width: 100,
      align: 'right',
      render: (count) => count ?? 0,
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
        <Link to={`/events/${record.id}`}>
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
        title="Events"
        description="Event listesi, filtreleme ve yönetim"
        icon={<CalendarOutlined />}
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
                  prefix={<CalendarOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Taslak"
                  value={stats.draft}
                  prefix={<FileOutlined />}
                  valueStyle={{ fontWeight: 600 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Yayında"
                  value={stats.published}
                  prefix={<SignalFilled />}
                  valueStyle={{ fontWeight: 600 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Kapalı"
                  value={stats.closed}
                  prefix={<InboxOutlined />}
                  valueStyle={{ fontWeight: 600 }}
                />
              </Card>
            </Col>
          </Row>
        )
      )}

      {/* Event List */}
      <Card
        bordered
        title="Event listesi"
        extra={
          <Space wrap>
            <Input
              placeholder="Ara (başlık, açıklama)"
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
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 130 }}
              placeholder="Tüm durumlar"
            >
              <Select.Option value="">Tüm durumlar</Select.Option>
              <Select.Option value="DRAFT">Taslak</Select.Option>
              <Select.Option value="PUBLISHED">Yayında</Select.Option>
              <Select.Option value="CLOSED">Kapalı</Select.Option>
            </Select>
            <Select
              value={feedType}
              onChange={(value) => {
                setFeedType(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 150 }}
              placeholder="Tüm feed türleri"
            >
              <Select.Option value="">Tüm feed türleri</Select.Option>
              <Select.Option value="PICKS">PICKS</Select.Option>
              <Select.Option value="ROASTS">ROASTS</Select.Option>
            </Select>
            <Select
              value={sort}
              onChange={(value) => {
                setSort(value as 'createdAt' | 'startDate' | 'endDate' | 'title');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 130 }}
            >
              <Select.Option value="createdAt">Oluşturulma</Select.Option>
              <Select.Option value="startDate">Başlangıç</Select.Option>
              <Select.Option value="endDate">Bitiş</Select.Option>
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
          dataSource={events}
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
                description="Event bulunamadı. Filtreleri değiştirerek tekrar deneyin."
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default EventList;
