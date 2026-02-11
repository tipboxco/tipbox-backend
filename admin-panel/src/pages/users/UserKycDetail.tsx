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
  Select,
  Input,
  message as antdMessage,
} from 'antd';
import { IdcardOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import IdDisplay from '../../components/IdDisplay';
import { fetchUserKycByUserId, updateKycReview } from '../../api/admin-kyc';
import type { AdminKycDetailResponse } from '../../types/admin';

const { Text } = Typography;

function UserKycDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<AdminKycDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewResult, setReviewResult] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchUserKycByUserId(userId);
        if (!cancelled && res.data) {
          setRecord(res.data);
          setReviewStatus(res.data.reviewStatus);
          setReviewResult(res.data.reviewResult);
          setReviewReason(res.data.reviewReason ?? '');
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load KYC record');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleSave = async () => {
    if (!record) return;
    setSaving(true);
    try {
      await updateKycReview(record.id, {
        reviewStatus: reviewStatus || undefined,
        reviewResult: reviewResult || undefined,
        reviewReason: reviewReason || undefined,
      });
      const res = await fetchUserKycByUserId(userId!);
      if (res.data) setRecord(res.data);
      antdMessage.success('KYC review result updated');
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <div>
        <Alert message="Invalid user" type="error" />
      </div>
    );
  }

  if (loading || !record) {
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
        <Button onClick={() => navigate('/users/kyc')}>Back to list</Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`KYC — ${record.userEmail ?? userId}`}
        description="KYC verification record"
        icon={<IdcardOutlined />}
        actions={
          <Space>
            <Button onClick={() => navigate('/users/kyc')}>
              Back to list
            </Button>
            <Button onClick={() => navigate(`/users/${userId}`)}>
              User details
            </Button>
          </Space>
        }
      />

      <div style={{ marginBottom: 16, marginTop: -8 }}>
        <IdDisplay id={record.id} variant="inline" label="Record ID:" />
      </div>

      <Card bordered title="KYC information" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">User ID</Text>
                <div>
                  <Link
                    to={`/users/${record.userId}`}
                    style={{ color: 'var(--tipbox-badge-outline)', textDecoration: 'underline' }}
                  >
                    {record.userId}
                  </Link>
                </div>
              </div>
              <div>
                <Text type="secondary">Sumsub Applicant ID</Text>
                <div>
                  <Text>{record.sumsubApplicantId}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary">Review status</Text>
                <div>
                  <Text>{record.reviewStatus}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary">Result</Text>
                <div>
                  <Text>{record.reviewResult}</Text>
                </div>
              </div>
            </Space>
          </Col>
          <Col xs={24} sm={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">KYC level</Text>
                <div>
                  <Text>{record.kycLevel ?? '—'}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary">Created</Text>
                <div>
                  <Text>
                    {new Date(record.createdAt).toLocaleString('en-US')}
                  </Text>
                </div>
              </div>
              <div>
                <Text type="secondary">Last updated</Text>
                <div>
                  <Text>
                    {new Date(record.updatedAt).toLocaleString('en-US')}
                  </Text>
                </div>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card bordered title="Update review">
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div style={{ width: '100%' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Review status
            </Text>
            <Select
              value={reviewStatus}
              onChange={setReviewStatus}
              style={{ width: '100%' }}
            >
              <Select.Option value="INIT">INIT</Select.Option>
              <Select.Option value="PENDING">PENDING</Select.Option>
              <Select.Option value="COMPLETED">COMPLETED</Select.Option>
              <Select.Option value="DECLINED">DECLINED</Select.Option>
              <Select.Option value="ON_HOLD">ON_HOLD</Select.Option>
            </Select>
          </div>

          <div style={{ width: '100%' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Result
            </Text>
            <Select
              value={reviewResult}
              onChange={setReviewResult}
              style={{ width: '100%' }}
            >
              <Select.Option value="NULL">NULL</Select.Option>
              <Select.Option value="GREEN">GREEN</Select.Option>
              <Select.Option value="YELLOW">YELLOW</Select.Option>
              <Select.Option value="RED">RED</Select.Option>
            </Select>
          </div>

          <div style={{ width: '100%' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Reason
            </Text>
            <Input
              value={reviewReason}
              onChange={(e) => setReviewReason(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <Button type="primary" onClick={handleSave} loading={saving}>
            Save
          </Button>
        </Space>
      </Card>
    </div>
  );
}

export default UserKycDetail;
