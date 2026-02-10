import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import ViewActionButton from '../../components/ViewActionButton';
import { fetchUsersStats, fetchUsers } from '../../api/admin-users';
import type { AdminUserListItem, AdminUsersStatsResponse } from '../../types/admin';
import { BADGE_COLOR_SECONDARY } from '../../constants/badge-colors';

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
          setError(e instanceof Error ? e.message : 'Failed to load list');
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
      title: 'Display Name',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 160,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Username',
      dataIndex: 'userName',
      key: 'userName',
      width: 140,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      ellipsis: true,
      render: (status) => (
        <Tag color={status === 'BANNED' ? BADGE_COLOR_SECONDARY : 'default'}>
          {status ?? '—'}
        </Tag>
      ),
    },
    {
      title: 'Email Verification',
      dataIndex: 'emailVerified',
      key: 'emailVerified',
      width: 100,
      align: 'center',
      ellipsis: true,
      render: (verified) =>
        verified ? (
          <CheckCircleOutlined style={{ color: 'var(--ant-color-success)', fontSize: 18 }} />
        ) : (
          <CloseCircleOutlined style={{ color: 'var(--ant-color-text-tertiary)', fontSize: 18 }} />
        ),
    },
    {
      title: 'Registration',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      ellipsis: true,
      render: (date) =>
        date ? new Date(date).toLocaleDateString('en-US') : '—',
    },
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_, record) => <ViewActionButton to={`/users/${record.id}`} />,
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
        title="Users"
        description="List, filter, and manage platform users"
        icon={<UserOutlined />}
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
                  title="Total"
                  value={stats.total}
                  prefix={<UserOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Banned"
                  value={stats.bannedCount}
                  prefix={<UserDeleteOutlined />}
                  valueStyle={{ fontWeight: 700, color: '#D8365D' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Email Verified"
                  value={stats.emailVerifiedCount}
                  prefix={<SafetyCertificateOutlined />}
                  valueStyle={{ fontWeight: 700, color: '#8B9D2D' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="New This Week"
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
        title="User List"
        extra={
          <Space wrap>
            <Input
              placeholder="Search (email, displayName, userName)"
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
              placeholder="All statuses"
            >
              <Select.Option value="">All statuses</Select.Option>
              <Select.Option value="ACTIVE">Active</Select.Option>
              <Select.Option value="BANNED">Banned</Select.Option>
            </Select>
            <Select
              value={emailVerified}
              onChange={(value) => {
                setEmailVerified(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 160 }}
              placeholder="Email verification"
            >
              <Select.Option value="">Email verification</Select.Option>
              <Select.Option value="true">Verified</Select.Option>
              <Select.Option value="false">Not verified</Select.Option>
            </Select>
            <Select
              value={sort}
              onChange={(value) => {
                setSort(value as 'email' | 'createdAt');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 100 }}
            >
              <Select.Option value="createdAt">Date</Select.Option>
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
              <Select.Option value="desc">Descending</Select.Option>
              <Select.Option value="asc">Ascending</Select.Option>
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
            showTotal: (total) => `Total ${total} records`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No users found"
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default UserList;
