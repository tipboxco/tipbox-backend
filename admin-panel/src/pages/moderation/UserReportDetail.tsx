import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Space,
  Button,
  Alert,
  Spin,
  Avatar,
  Typography,
  Badge,
  Modal,
  Form,
  Select,
  Input,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import {
  fetchUserReport,
  updateUserReport,
  deleteUserReport,
  type UserReportDetail,
} from '../../api/admin-user-reports';

const { Title, Text } = Typography;

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

function UserReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<UserReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateForm] = Form.useForm();

  const loadReport = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUserReport(id);
      setReport(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleUpdate = async (values: { status: string; reviewNote?: string }) => {
    if (!id) return;

    try {
      await updateUserReport(id, {
        status: values.status as 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED',
        reviewNote: values.reviewNote || null,
      });
      message.success('Report updated successfully');
      setUpdateModalOpen(false);
      updateForm.resetFields();
      loadReport();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update report');
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    Modal.confirm({
      title: 'Dismiss Report',
      content: 'Are you sure you want to dismiss this report?',
      okText: 'Dismiss',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteUserReport(id);
          message.success('Report dismissed successfully');
          navigate('/moderation/user-reports');
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to dismiss report');
        }
      },
    });
  };

  const openUpdateModal = () => {
    if (!report) return;
    updateForm.setFieldsValue({
      status: report.status,
      reviewNote: report.reviewNote || '',
    });
    setUpdateModalOpen(true);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/moderation/user-reports')}
          style={{ marginBottom: 16 }}
        >
          Back to Reports
        </Button>
        <Alert
          message="Error"
          description={error || 'Report not found'}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/moderation/user-reports')}
        >
          Back to Reports
        </Button>
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={openUpdateModal}
        >
          Update Status
        </Button>
        <Button
          danger
          icon={<CloseCircleOutlined />}
          onClick={handleDelete}
          disabled={report.status === 'DISMISSED'}
        >
          Dismiss
        </Button>
      </Space>

      <Card title={<Title level={4}>Report Details</Title>} style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="Report ID">{report.id}</Descriptions.Item>
          <Descriptions.Item label="Type">
            <Tag color={REPORT_TYPE_COLORS[report.reportType]}>{report.reportType}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Badge status={STATUS_COLORS[report.status] as any} text={report.status} />
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {new Date(report.createdAt).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Reason" span={2}>
            <Text strong>{report.reason}</Text>
          </Descriptions.Item>
          {report.description && (
            <Descriptions.Item label="Description" span={2}>
              {report.description}
            </Descriptions.Item>
          )}
          {report.contentId && (
            <Descriptions.Item label="Content ID" span={2}>
              <Text code>{report.contentId}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card title="Reporter" style={{ marginBottom: 16 }}>
        <Space align="center">
          <Avatar
            size={64}
            src={report.reporter.avatarUrl}
            icon={<UserOutlined />}
          />
          <div>
            <div>
              <Text strong>
                <Link to={`/users/${report.reporter.id}`}>
                  {report.reporter.username || report.reporter.displayName || 'Unknown'}
                </Link>
              </Text>
            </div>
            <div>
              <Text type="secondary">{report.reporter.email}</Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ID: {report.reporter.id}
              </Text>
            </div>
          </div>
        </Space>
      </Card>

      <Card title="Reported User" style={{ marginBottom: 16 }}>
        <Space align="center">
          <Avatar
            size={64}
            src={report.reportedUser.avatarUrl}
            icon={<UserOutlined />}
          />
          <div>
            <div>
              <Text strong>
                <Link to={`/users/${report.reportedUser.id}`}>
                  {report.reportedUser.username ||
                    report.reportedUser.displayName ||
                    'Unknown'}
                </Link>
              </Text>
              <Tag style={{ marginLeft: 8 }}>{report.reportedUser.status}</Tag>
            </div>
            <div>
              <Text type="secondary">{report.reportedUser.email}</Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ID: {report.reportedUser.id}
              </Text>
            </div>
          </div>
        </Space>
      </Card>

      {report.reviewer && (
        <Card title="Review Information" style={{ marginBottom: 16 }}>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Reviewer">
              {report.reviewer.username || report.reviewer.displayName || 'Unknown'}
            </Descriptions.Item>
            {report.reviewNote && (
              <Descriptions.Item label="Review Note">{report.reviewNote}</Descriptions.Item>
            )}
            <Descriptions.Item label="Last Updated">
              {new Date(report.updatedAt).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Update Report Modal */}
      <Modal
        title="Update Report"
        open={updateModalOpen}
        onCancel={() => {
          setUpdateModalOpen(false);
          updateForm.resetFields();
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

export default UserReportDetail;
