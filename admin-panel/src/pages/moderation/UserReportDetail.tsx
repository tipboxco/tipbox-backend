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
  Modal,
  Input,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import {
  fetchUserReport,
  resolveUserReport,
  deleteUserReport,
  type UserReportDetail as UserReportDetailType,
} from '../../api/admin-user-reports';

const { Title, Text } = Typography;

function UserReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<UserReportDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [adminNote, setAdminNote] = useState('');

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

  const handleResolve = async () => {
    if (!id) return;
    try {
      await resolveUserReport(id, { adminNote: adminNote || null });
      message.success('Report resolved');
      setResolveModalOpen(false);
      setAdminNote('');
      loadReport();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to resolve report');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    Modal.confirm({
      title: 'Delete Report',
      content: 'Are you sure you want to delete this report? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteUserReport(id);
          message.success('Report deleted');
          navigate('/moderation/user-reports');
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delete report');
        }
      },
    });
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
        {!report.resolved && (
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => {
              setAdminNote('');
              setResolveModalOpen(true);
            }}
          >
            Resolve
          </Button>
        )}
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={handleDelete}
        >
          Delete
        </Button>
      </Space>

      <Card title={<Title level={4}>Report Details</Title>} style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="Report ID">{report.id}</Descriptions.Item>
          <Descriptions.Item label="Category">
            <Tag>{report.category}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={report.resolved ? 'success' : 'warning'}>
              {report.resolved ? 'Resolved' : 'Open'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {new Date(report.createdAt).toLocaleString()}
          </Descriptions.Item>
          {report.description && (
            <Descriptions.Item label="Description" span={2}>
              {report.description}
            </Descriptions.Item>
          )}
          {report.resolvedAt && (
            <Descriptions.Item label="Resolved At">
              {new Date(report.resolvedAt).toLocaleString()}
            </Descriptions.Item>
          )}
          {report.resolvedBy && (
            <Descriptions.Item label="Resolved By">
              <Text code>{report.resolvedBy}</Text>
            </Descriptions.Item>
          )}
          {report.adminNote && (
            <Descriptions.Item label="Admin Note" span={2}>
              {report.adminNote}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card title="Reporter" style={{ marginBottom: 16 }}>
        <Space align="center">
          <Avatar
            size={64}
            src={undefined}
            icon={<UserOutlined />}
          />
          <div>
            <div>
              <Text strong>
                <Link to={`/users/${report.reporter.id}`}>
                  {report.reporter.userName || report.reporter.displayName || 'Unknown'}
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
            src={undefined}
            icon={<UserOutlined />}
          />
          <div>
            <div>
              <Text strong>
                <Link to={`/users/${report.reportedUser.id}`}>
                  {report.reportedUser.userName || report.reportedUser.displayName || 'Unknown'}
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

      <Modal
        title="Resolve Report"
        open={resolveModalOpen}
        onCancel={() => {
          setResolveModalOpen(false);
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

export default UserReportDetail;
