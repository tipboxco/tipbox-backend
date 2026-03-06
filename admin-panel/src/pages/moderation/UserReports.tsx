import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Select,
  Input,
  Empty,
  Alert,
  Modal,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  FlagOutlined,
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchUserReportsStats,
  fetchUserReports,
  resolveUserReport,
  deleteUserReport,
  type UserReportStatsResponse,
  type UserReportListItem,
} from '../../api/admin-user-reports';

const PAGE_SIZE = 20;

function UserReports() {
  const [stats, setStats] = useState<UserReportStatsResponse | null>(null);
  const [reports, setReports] = useState<UserReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedFilter, setResolvedFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchUserReportsStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load statistics');
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadReports = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUserReports({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        resolved: resolvedFilter ? (resolvedFilter as 'true' | 'false') : undefined,
        category: categoryFilter || undefined,
        search: search || undefined,
      });
      setReports(res.data ?? []);
      setTotal(res.pagination?.total ?? 0);
      setCurrentPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load user reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedFilter, categoryFilter, search]);

  const openResolveModal = (reportId: string) => {
    setSelectedReportId(reportId);
    setAdminNote('');
    setResolveModalOpen(true);
  };

  const handleResolve = async () => {
    if (!selectedReportId) return;
    try {
      await resolveUserReport(selectedReportId, {
        adminNote: adminNote || null,
      });
      message.success('Report resolved');
      setResolveModalOpen(false);
      setSelectedReportId(null);
      setAdminNote('');
      loadReports(currentPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to resolve report');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Delete Report',
      content: 'Are you sure you want to delete this report? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteUserReport(id);
          message.success('Report deleted');
          loadReports(currentPage);
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delete report');
        }
      },
    });
  };

  const columns: ColumnsType<UserReportListItem> = [
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (cat) => <Tag>{cat}</Tag>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc) => desc ?? '—',
    },
    {
      title: 'Reporter',
      key: 'reporter',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <Link to={`/users/${record.reporterId}`}>
          {record.reporterName || 'Unknown'}
        </Link>
      ),
    },
    {
      title: 'Reported User',
      key: 'reportedUser',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <Link to={`/users/${record.reportedUserId}`}>
          {record.reportedUserName || record.reportedUserEmail || 'Unknown'}
        </Link>
      ),
    },
    {
      title: 'Status',
      key: 'resolved',
      width: 100,
      render: (_, record) => (
        <Tag color={record.resolved ? 'success' : 'warning'}>
          {record.resolved ? 'Resolved' : 'Open'}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => window.open(`/moderation/user-reports/${record.id}`, '_blank')}
            title="View details"
          />
          {!record.resolved && (
            <Button
              size="small"
              type="text"
              icon={<CheckCircleOutlined />}
              onClick={() => openResolveModal(record.id)}
              title="Resolve"
            />
          )}
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
            title="Delete"
          />
        </Space>
      ),
    },
  ];

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Reports',
          value: stats.total,
          icon: <FlagOutlined />,
        },
        {
          label: 'Open',
          value: stats.open,
          icon: <FlagOutlined />,
          valueStyle: { color: '#faad14' },
        },
        {
          label: 'Resolved',
          value: stats.resolved,
          icon: <FlagOutlined />,
          valueStyle: { color: '#52c41a' },
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="User Reports"
        description="Review and manage user reports"
        icon={<FlagOutlined />}
        stats={statsData}
        statsLoading={loadingStats}
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
        title="Reports"
        extra={
          <Space wrap>
            <Input
              placeholder="Search description/category"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              placeholder="Status"
              value={resolvedFilter || undefined}
              onChange={(val) => setResolvedFilter(val ?? '')}
              style={{ width: 130 }}
              allowClear
            >
              <Select.Option value="false">Open</Select.Option>
              <Select.Option value="true">Resolved</Select.Option>
            </Select>
            <Select
              placeholder="Category"
              value={categoryFilter || undefined}
              onChange={(val) => setCategoryFilter(val ?? '')}
              style={{ width: 150 }}
              allowClear
            >
              {stats?.byCategory &&
                Object.keys(stats.byCategory).map((cat) => (
                  <Select.Option key={cat} value={cat}>
                    {cat}
                  </Select.Option>
                ))}
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={reports}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} reports`,
            onChange: loadReports,
          }}
          locale={{
            emptyText: <Empty description="No user reports found" />,
          }}
        />
      </Card>

      <Modal
        title="Resolve Report"
        open={resolveModalOpen}
        onCancel={() => {
          setResolveModalOpen(false);
          setSelectedReportId(null);
          setAdminNote('');
        }}
        onOk={handleResolve}
        okText="Resolve"
      >
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontWeight: 500 }}>Admin Note (optional)</label>
        </div>
        <Input.TextArea
          rows={4}
          placeholder="Add a note about your resolution"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}

export default UserReports;
