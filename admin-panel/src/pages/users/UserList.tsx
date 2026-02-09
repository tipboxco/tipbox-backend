import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  UserOutlined,
  UserDeleteOutlined,
  SafetyCertificateOutlined,
  UserAddOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { fetchUsersStats, fetchUsers } from '../../api/admin-users';
import type { AdminUserListItem, AdminUsersStatsResponse } from '../../types/admin';

const PAGE_SIZE = 20;

function UserList() {
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState<AdminUsersStatsResponse | null>(null);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [status, setStatus] = useState<string>(searchParams.get('status') ?? '');
  const [emailVerified, setEmailVerified] = useState<string>(
    searchParams.get('emailVerified') ?? ''
  );
  const [sort, setSort] = useState<'email' | 'createdAt'>(
    (searchParams.get('sort') as 'email' | 'createdAt') ?? 'createdAt'
  );
  const [order, setOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('order') as 'asc' | 'desc') ?? 'desc'
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchUsersStats();
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
        const res = await fetchUsers({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          search: search || undefined,
          status: status || undefined,
          emailVerified:
            emailVerified === 'true'
              ? true
              : emailVerified === 'false'
              ? false
              : undefined,
          sort,
          order,
        });
        if (!cancelled) {
          setUsers(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
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
  }, [pagination.offset, search, status, emailVerified, sort, order]);

  const columns: ColumnsType<AdminUserListItem> = [
    {
      title: 'Görünen ad',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (text) => text ?? '—',
    },
    {
      title: 'Kullanıcı adı',
      dataIndex: 'userName',
      key: 'userName',
      render: (text) => text ?? '—',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (text) => text ?? '—',
    },
    {
      title: 'Durum',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'BANNED' ? 'red' : 'default'}>
          {status ?? '—'}
        </Tag>
      ),
    },
    {
      title: 'Email doğru',
      dataIndex: 'emailVerified',
      key: 'emailVerified',
      render: (verified) => (
        <Tag color={verified ? 'success' : 'default'}>
          {verified ? 'Evet' : 'Hayır'}
        </Tag>
      ),
    },
    {
      title: 'Kayıt',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) =>
        date ? new Date(date).toLocaleDateString('tr-TR') : '—',
    },
    {
      title: '',
      key: 'action',
      render: (_, record) => (
        <Link to={`/users/${record.id}`}>
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
        title="Kullanıcılar"
        description="Platform kullanıcılarını listele, filtrele ve yönet"
        icon={<UserOutlined />}
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
                  prefix={<UserOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Yasaklı"
                  value={stats.bannedCount}
                  prefix={<UserDeleteOutlined />}
                  valueStyle={{ fontWeight: 700, color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Email Doğrulu"
                  value={stats.emailVerifiedCount}
                  prefix={<SafetyCertificateOutlined />}
                  valueStyle={{ fontWeight: 700, color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Bu Hafta Yeni"
                  value={stats.newThisWeek}
                  prefix={<UserAddOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                />
              </Card>
            </Col>
          </Row>
        )
      )}

      {/* User List Table */}
      <Card
        bordered
        title="Kullanıcı listesi"
        extra={
          <Space wrap>
            <Input
              placeholder="Ara (email, displayName, userName)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              prefix={<SearchOutlined />}
              style={{ width: 280 }}
              allowClear
            />
            <Select
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 140 }}
              placeholder="Tüm durumlar"
            >
              <Select.Option value="">Tüm durumlar</Select.Option>
              <Select.Option value="ACTIVE">Aktif</Select.Option>
              <Select.Option value="BANNED">Yasaklı</Select.Option>
            </Select>
            <Select
              value={emailVerified}
              onChange={(value) => {
                setEmailVerified(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 160 }}
              placeholder="Email doğrulama"
            >
              <Select.Option value="">Email doğrulama</Select.Option>
              <Select.Option value="true">Doğrulanmış</Select.Option>
              <Select.Option value="false">Doğrulanmamış</Select.Option>
            </Select>
            <Select
              value={sort}
              onChange={(value) => {
                setSort(value as 'email' | 'createdAt');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 100 }}
            >
              <Select.Option value="createdAt">Tarih</Select.Option>
              <Select.Option value="email">Email</Select.Option>
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
          dataSource={users}
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
                description="Kullanıcı bulunamadı"
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default UserList;
