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
  Form,
  message,
  Badge,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  FlagOutlined,
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchUserReportsStats,
  fetchUserReports,
  updateUserReport,
  deleteUserReport,
  type UserReportStatsResponse,
  type UserReportListItem,
} from '../../api/admin-user-reports';

const PAGE_SIZE = 20;

const REPORT_TYPE_COLORS: Record<string, string> = {
  POST: 'blue',
  COMMENT: 'cyan',
  USER: 'purple',
  MESSAGE: 'orange',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'gold',
  REVIEWING: 'processing',
  RESOLVED: 'success',
  DISMISSED: 'default',
};

function UserReports() {
  const [stats, setStats] = useState<UserReportStatsResponse | null>(null);
  const [reports, setReports] = useState<UserReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [reportType, setReportType] = useState<string>('');
  const [search, setSearch] = useState('');
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<UserReportListItem | null>(null);
  const [updateForm] = Form.useForm();
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

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
        status: status || undefined,
        reportType: reportType || undefined,
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
  }, [status, reportType, search]);

  const openUpdateModal = (report: UserReportListItem) => {
    setSelectedReport(report);
    updateForm.setFieldsValue({
      status: report.status,
      reviewNote: report.reviewNote || '',
    });
    setUpdateModalOpen(true);
  };

  const handleUpdate = async (values: { status: string; reviewNote?: string }) => {
    if (!selectedReport) return;

    try {
      await updateUserReport(selectedReport.id, {
        status: values.status as 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED',
        reviewNote: values.reviewNote || null,
      });
      message.success('Report updated successfully');
      setUpdateModalOpen(false);
      updateForm.resetFields();
      setSelectedReport(null);
      loadReports(currentPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update report');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Dismiss Report',
      content: 'Are you sure you want to dismiss this report?',
      okText: 'Dismiss',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteUserReport(id);
          message.success('Report dismissed successfully');
          loadReports(currentPage);
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to dismiss report');
        }
      },
    });
  };

  const columns: ColumnsType<UserReportListItem> = [
    {
      title: 'Type',
      dataIndex: 'reportType',
      key: 'reportType',
      width: 100,
      render: (type) => <Tag color={REPORT_TYPE_COLORS[type]}>{type}</Tag>,
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      width: 150,
    },
    {
      title: 'Reporter',
      key: 'reporter',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <Link to={`/users/${record.reporterId}`}>
          {record.reporterUsername || record.reporterDisplayName || 'Unknown'}
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
          {record.reportedUsername || record.reportedUserEmail || 'Unknown'}
        </Link>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Badge status={STATUS_COLORS[status] as any} text={status} />
      ),
    },
    {
      title: 'Reviewer',
      key: 'reviewer',
      width: 120,
      ellipsis: true,
      render: (_, record) => record.reviewerUsername || '—',
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
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => window.open(`/moderation/user-reports/${record.id}`, '_blank')}
            title="View details"
          />
          <Button
            size="small"
            type="text"
            icon={<CheckCircleOutlined />}
            onClick={() => openUpdateModal(record)}
            title="Update status"
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => handleDelete(record.id)}
            title="Dismiss"
            disabled={record.status === 'DISMISSED'}
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
          label: 'Pending',
          value: stats.pending,
          icon: <FlagOutlined />,
          valueStyle: { color: '#faad14' },
        },
        {
          label: 'Reviewing',
          value: stats.reviewing,
          icon: <FlagOutlined />,
          valueStyle: { color: '#1890ff' },
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
        description="Review and manage user-reported content"
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
              placeholder="Search reason/description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              placeholder="Report Type"
              value={reportType || undefined}
              onChange={setReportType}
              style={{ width: 150 }}
              allowClear
            >
              <Select.Option value="POST">Post</Select.Option>
              <Select.Option value="COMMENT">Comment</Select.Option>
              <Select.Option value="USER">User</Select.Option>
              <Select.Option value="MESSAGE">Message</Select.Option>
            </Select>
            <Select
              placeholder="Status"
              value={status || undefined}
              onChange={setStatus}
              style={{ width: 150 }}
              allowClear
            >
              <Select.Option value="PENDING">Pending</Select.Option>
              <Select.Option value="REVIEWING">Reviewing</Select.Option>
              <Select.Option value="RESOLVED">Resolved</Select.Option>
              <Select.Option value="DISMISSED">Dismissed</Select.Option>
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

      {/* Update Report Modal */}
      <Modal
        title="Update Report"
        open={updateModalOpen}
        onCancel={() => {
          setUpdateModalOpen(false);
          updateForm.resetFields();
          setSelectedReport(null);
        }}
        onOk={() => updateForm.submit()}
        okText="Update"
      >
        <Form form={updateForm} layout="vertical" onFinish={handleUpdate}>
          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select status' }]}
          >
            <Select>
              <Select.Option value="PENDING">Pending</Select.Option>
              <Select.Option value="REVIEWING">Reviewing</Select.Option>
              <Select.Option value="RESOLVED">Resolved</Select.Option>
              <Select.Option value="DISMISSED">Dismissed</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="reviewNote" label="Review Note">
            <Input.TextArea rows={4} placeholder="Add a note about your review decision" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default UserReports;
