import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Button,
  Spin,
  Alert,
  Typography,
  Space,
  Tag,
  Checkbox,
  Input,
  message as antdMessage,
} from 'antd';
import { FlagOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import IdDisplay from '../../components/IdDisplay';
import { fetchUserReport, resolveUserReport } from '../../api/admin-reports';
import type { AdminUserReportDetailResponse } from '../../types/admin';
import { BADGE_COLOR_PRIMARY } from '../../constants/badge-colors';

const { Text, Paragraph } = Typography;

function UserReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<AdminUserReportDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchUserReport(id);
        if (!cancelled && res.data) {
          setReport(res.data);
          setResolved(res.data.resolved ?? false);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleResolve = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await resolveUserReport(id, { resolved, adminNote: adminNote || undefined });
      const res = await fetchUserReport(id);
      if (res.data) setReport(res.data);
      antdMessage.success(
        resolved ? 'Report marked as resolved' : 'Report updated'
      );
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  if (!id) {
    return (
      <div>
        <Alert message="Invalid report" type="error" />
      </div>
    );
  }

  if (loading || !report) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="Error"
          description={error}
          icon={<ExclamationCircleOutlined />}
        />
        <Button onClick={() => navigate('/users/reports')}>Back to list</Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="User Report"
        description={report.category}
        icon={<FlagOutlined />}
        backTo="/users/reports"
        backLabel="Back to list"
      />

      <div style={{ marginBottom: 16, marginTop: -8 }}>
        <IdDisplay id={report.id} variant="inline" label="Report ID:" />
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card bordered title="Reported user">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">ID</Text>
                <div>
                  <Text>{report.reportedUserId}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary">Display name / Email</Text>
                <div>
                  <Link
                    to={`/users/${report.reportedUserId}`}
                    style={{ color: 'var(--tipbox-badge-outline)', textDecoration: 'underline' }}
                  >
                    {report.reportedUserDisplayName ??
                      report.reportedUserEmail ??
                      report.reportedUserId}
                  </Link>
                </div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card bordered title="Reporter">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">ID</Text>
                <div>
                  <Text>{report.reporterId}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary">Display name / Email</Text>
                <div>
                  <Link
                    to={`/users/${report.reporterId}`}
                    style={{ color: 'var(--tipbox-badge-outline)', textDecoration: 'underline' }}
                  >
                    {report.reporterDisplayName ??
                      report.reporterEmail ??
                      report.reporterId}
                  </Link>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card bordered title="Description" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Paragraph>{report.description ?? '—'}</Paragraph>
          <div>
            <Text type="secondary">Date</Text>
            <div>
              <Text>{new Date(report.createdAt).toLocaleString('en-US')}</Text>
            </div>
          </div>
          <div>
            <Text type="secondary">Status</Text>
            <div>
              <Tag color={report.resolved ? BADGE_COLOR_PRIMARY : 'default'}>
                {report.resolved ? 'Resolved' : 'Pending'}
              </Tag>
              {report.resolvedAt && (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  {new Date(report.resolvedAt).toLocaleString('en-US')}
                </Text>
              )}
            </div>
          </div>
        </Space>
      </Card>

      <Card bordered title="Resolve">
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Checkbox
            checked={resolved}
            onChange={(e) => setResolved(e.target.checked)}
          >
            Resolved
          </Checkbox>

          <div style={{ width: '100%' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Admin note
            </Text>
            <Input
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Optional note"
            />
          </div>

          <Button
            type="primary"
            onClick={handleResolve}
            loading={saving}
          >
            Save
          </Button>
        </Space>
      </Card>
    </div>
  );
}

export default UserReportDetail;
