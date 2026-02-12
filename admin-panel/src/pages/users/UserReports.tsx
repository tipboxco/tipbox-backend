import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Table, Select, Space, Tag, Button, Empty, Alert } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { FlagOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import ViewActionButton from '../../components/ViewActionButton';
import { fetchUserReports } from '../../api/admin-reports';
import type { AdminUserReportListItem } from '../../types/admin';
import { BADGE_COLOR_PRIMARY } from '../../constants/badge-colors';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function UserReports() {
  const [reports, setReports] = useState<AdminUserReportListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('');
  const [resolved, setResolved] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchUserReports({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          category: category || undefined,
          sort: 'createdAt',
          order: 'desc',
        });
        if (!cancelled) {
          setReports(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load list');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset, category]);

  const filteredReports =
    resolved === ''
      ? reports
      : resolved === 'true'
      ? reports.filter((r) => r.resolved)
      : reports.filter((r) => !r.resolved);

  const columns: ColumnsType<AdminUserReportListItem> = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATETIME_FULL,
      ellipsis: true,
      render: (date) => new Date(date).toLocaleString('en-US'),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      ellipsis: true,
    },
    {
      title: 'Reported user',
      key: 'reported',
      width: TABLE_COLUMN_WIDTHS.DATETIME_FULL,
      ellipsis: true,
      render: (_, record) => (
        <Link
          to={`/users/${record.reportedUserId}`}
          style={{ color: 'var(--tipbox-badge-outline)', textDecoration: 'underline' }}
          title={record.reportedUserDisplayName ?? record.reportedUserEmail ?? record.reportedUserId}
        >
          {record.reportedUserDisplayName ??
            record.reportedUserEmail ??
            record.reportedUserId}
        </Link>
      ),
    },
    {
      title: 'Reporter',
      key: 'reporter',
      width: TABLE_COLUMN_WIDTHS.DATETIME_FULL,
      ellipsis: true,
      render: (_, record) => (
        <Link
          to={`/users/${record.reporterId}`}
          style={{ color: 'var(--tipbox-badge-outline)', textDecoration: 'underline' }}
          title={record.reporterDisplayName ?? record.reporterEmail ?? record.reporterId}
        >
          {record.reporterDisplayName ??
            record.reporterEmail ??
            record.reporterId}
        </Link>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'resolved',
      key: 'resolved',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      ellipsis: true,
      render: (resolved) => (
        <Tag color={resolved ? BADGE_COLOR_PRIMARY : 'default'}>
          {resolved ? 'Resolved' : 'Pending'}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON,
      render: (_, record) => <ViewActionButton to={`/users/reports/${record.id}`} />,
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
        title="User reports"
        description="Review and resolve user reports"
        icon={<FlagOutlined />}
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
        title="Report list"
        extra={
          <Space>
            <Select
              value={category}
              onChange={(value) => {
                setCategory(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 160 }}
              placeholder="All categories"
            >
              <Select.Option value="">All categories</Select.Option>
              <Select.Option value="SPAM">SPAM</Select.Option>
              <Select.Option value="ABUSE">ABUSE</Select.Option>
              <Select.Option value="OTHER">OTHER</Select.Option>
            </Select>
            <Select
              value={resolved}
              onChange={setResolved}
              style={{ width: 120 }}
              placeholder="All"
            >
              <Select.Option value="">All</Select.Option>
              <Select.Option value="true">Resolved</Select.Option>
              <Select.Option value="false">Pending</Select.Option>
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredReports}
          rowKey="id"
          loading={loading}
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
                description="No reports found"
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default UserReports;
