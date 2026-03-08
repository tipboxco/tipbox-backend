import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  Table,
  Input,
  Select,
  Space,
  Tag,
  Empty,
  Alert,
  Button,
  Dropdown,
  Modal,
  Avatar,
  message,
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
  DownOutlined,
  StopOutlined,
  DownloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import type { StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import { fetchUsersStats, fetchUsers, banUser, unbanUser, deleteUser } from '../../api/admin-users';
import type { AdminUserListItem, AdminUsersStatsResponse } from '../../types/admin';
import { BADGE_COLOR_SECONDARY } from '../../constants/badge-colors';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';
import { exportToCSV, exportToJSON, exportToExcel, sanitizeFilename, formatDateForExport } from '../../utils/export';

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
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

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

  const loadUsers = async () => {
    setLoadingList(true);
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
      setUsers(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load list');
    } finally {
      setLoadingList(false);
    }
  };

  const handleBulkBan = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select users to ban');
      return;
    }

    Modal.confirm({
      title: 'Ban Users',
      content: `Are you sure you want to ban ${selectedRowKeys.length} user(s)? They will no longer be able to access the platform.`,
      okText: 'Ban',
      okType: 'danger',
      onOk: async () => {
        const hide = message.loading('Banning users...', 0);
        let successCount = 0;
        let failCount = 0;

        for (const userId of selectedRowKeys) {
          try {
            await banUser(userId as string, 'Bulk ban via admin panel');
            successCount++;
          } catch (e) {
            failCount++;
          }
        }

        hide();

        if (successCount > 0) {
          message.success(`Successfully banned ${successCount} user(s)`);
        }
        if (failCount > 0) {
          message.error(`Failed to ban ${failCount} user(s)`);
        }

        setSelectedRowKeys([]);
        loadUsers();
      },
    });
  };

  const handleBulkUnban = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select users to unban');
      return;
    }

    Modal.confirm({
      title: 'Unban Users',
      content: `Are you sure you want to unban ${selectedRowKeys.length} user(s)? They will regain access to the platform.`,
      okText: 'Unban',
      onOk: async () => {
        const hide = message.loading('Unbanning users...', 0);
        let successCount = 0;
        let failCount = 0;

        for (const userId of selectedRowKeys) {
          try {
            await unbanUser(userId as string);
            successCount++;
          } catch (e) {
            failCount++;
          }
        }

        hide();

        if (successCount > 0) {
          message.success(`Successfully unbanned ${successCount} user(s)`);
        }
        if (failCount > 0) {
          message.error(`Failed to unban ${failCount} user(s)`);
        }

        setSelectedRowKeys([]);
        loadUsers();
      },
    });
  };

  const handleExport = async (format: 'csv' | 'json' | 'excel') => {
    const hide = message.loading(`Preparing ${format.toUpperCase()} export...`, 0);

    try {
      // Fetch all data with current filters (limit 10,000 for safety)
      const res = await fetchUsers({
        limit: 10000,
        offset: 0,
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

      const exportData = res.data ?? [];

      if (exportData.length === 0) {
        hide();
        message.warning('No data to export');
        return;
      }

      // Define columns for export
      const columns = [
        { key: 'id' as const, label: 'User ID' },
        { key: 'displayName' as const, label: 'Display Name' },
        { key: 'userName' as const, label: 'Username' },
        { key: 'email' as const, label: 'Email' },
        { key: 'status' as const, label: 'Status' },
        { key: 'emailVerified' as const, label: 'Email Verified' },
        { key: 'createdAt' as const, label: 'Registration Date' },
      ];

      // Transform data for export
      const transformedData = exportData.map((user) => ({
        id: user.id,
        displayName: user.displayName ?? '',
        userName: user.userName ?? '',
        email: user.email ?? '',
        status: user.status ?? 'ACTIVE',
        emailVerified: user.emailVerified ? 'Yes' : 'No',
        createdAt: formatDateForExport(user.createdAt),
      }));

      const filename = sanitizeFilename(`users_${new Date().toISOString().split('T')[0]}`);

      if (format === 'csv') {
        exportToCSV(transformedData, filename, columns);
      } else if (format === 'json') {
        exportToJSON(exportData, filename);
      } else if (format === 'excel') {
        exportToExcel(transformedData, filename, columns);
      }

      hide();
      message.success(`Exported ${exportData.length} users to ${format.toUpperCase()}`);
    } catch (e) {
      hide();
      message.error(e instanceof Error ? e.message : 'Export failed');
    }
  };

  const handleDeleteUser = (userId: string, displayName: string) => {
    Modal.confirm({
      title: 'Delete User',
      content: `Are you sure you want to permanently delete "${displayName}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteUser(userId);
          message.success('User deleted successfully');
          loadUsers();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delete user');
        }
      },
    });
  };

  const columns: ColumnsType<AdminUserListItem> = [
    {
      title: 'Display Name',
      dataIndex: 'displayName',
      key: 'displayName',
      width: TABLE_COLUMN_WIDTHS.DATETIME_FULL,
      ellipsis: true,
      render: (text: string | null, record: AdminUserListItem) => (
        <Space size="small" align="center">
          <Avatar src={record.avatarUrl} icon={<UserOutlined />} size={28} />
          <span>{text ?? '—'}</span>
        </Space>
      ),
    },
    {
      title: 'Username',
      dataIndex: 'userName',
      key: 'userName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FIXED,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
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
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      ellipsis: true,
      render: (verified) =>
        verified ? (
          <CheckCircleOutlined style={{ color: 'var(--ant-color-success)', fontSize: 21 }} />
        ) : (
          <CloseCircleOutlined style={{ color: 'var(--ant-color-text-tertiary)', fontSize: 21 }} />
        ),
    },
    {
      title: 'Registration',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) =>
        date ? new Date(date).toLocaleDateString('en-US') : '—',
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTONS,
      render: (_, record) => (
        <Space size="small">
          <ViewActionButton to={`/users/${record.id}`} />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteUser(record.id, record.displayName ?? record.email ?? record.id)}
          />
        </Space>
      ),
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
          icon: <UserOutlined />,
        },
        {
          label: 'Banned',
          value: stats.bannedCount,
          icon: <UserDeleteOutlined />,
          valueColor: '#D8365D',
        },
        {
          label: 'Email Verified',
          value: stats.emailVerifiedCount,
          icon: <SafetyCertificateOutlined />,
          valueColor: '#8B9D2D',
        },
        {
          label: 'New This Week',
          value: stats.newThisWeek,
          icon: <UserAddOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Users"
        description="List, filter, and manage platform users"
        icon={<UserOutlined />}
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

      {/* User List Table */}
      <Card
        bordered
        title="User List"
        extra={
          <Space wrap>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'csv',
                    label: 'Export as CSV',
                    icon: <DownloadOutlined />,
                    onClick: () => handleExport('csv'),
                  },
                  {
                    key: 'excel',
                    label: 'Export as Excel',
                    icon: <DownloadOutlined />,
                    onClick: () => handleExport('excel'),
                  },
                  {
                    key: 'json',
                    label: 'Export as JSON',
                    icon: <DownloadOutlined />,
                    onClick: () => handleExport('json'),
                  },
                ],
              }}
            >
              <Button icon={<DownloadOutlined />}>
                Export
              </Button>
            </Dropdown>
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
        {selectedRowKeys.length > 0 && (
          <Alert
            message={`${selectedRowKeys.length} user(s) selected`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            action={
              <Space>
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'ban',
                        label: 'Ban Users',
                        icon: <UserDeleteOutlined />,
                        danger: true,
                        onClick: handleBulkBan,
                      },
                      {
                        key: 'unban',
                        label: 'Unban Users',
                        icon: <StopOutlined />,
                        onClick: handleBulkUnban,
                      },
                    ],
                  }}
                >
                  <Button>
                    Bulk Actions <DownOutlined />
                  </Button>
                </Dropdown>
                <Button onClick={() => setSelectedRowKeys([])}>Clear Selection</Button>
              </Space>
            }
          />
        )}
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loadingList}
          scroll={TABLE_SCROLL_CONFIGS.AUTO}
          rowSelection={{
            selectedRowKeys,
            onChange: (newSelectedRowKeys) => setSelectedRowKeys(newSelectedRowKeys),
          }}
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
