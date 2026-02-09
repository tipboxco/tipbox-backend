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
          setError(e instanceof Error ? e.message : 'KYC kaydı yüklenemedi');
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
      antdMessage.success('KYC inceleme sonucu güncellendi');
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Güncelleme başarısız');
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <div>
        <Alert message="Geçersiz kullanıcı" type="error" />
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
          title="Hata"
          description={error}
          icon={<ExclamationCircleOutlined />}
        />
        <Button onClick={() => navigate('/users/kyc')}>Listeye dön</Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`KYC — ${record.userEmail ?? userId}`}
        description={`Kayıt: ${record.id.slice(0, 8)}…`}
        icon={<IdcardOutlined />}
        actions={
          <Space>
            <Button onClick={() => navigate('/users/kyc')}>
              Listeye dön
            </Button>
            <Button onClick={() => navigate(`/users/${userId}`)}>
              Kullanıcı detayı
            </Button>
          </Space>
        }
      />

      <Card bordered title="KYC bilgileri" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">Kullanıcı ID</Text>
                <div>
                  <Link to={`/users/${record.userId}`}>
                    <Button type="link" size="small" style={{ padding: 0 }}>
                      {record.userId}
                    </Button>
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
                <Text type="secondary">İnceleme durumu</Text>
                <div>
                  <Text>{record.reviewStatus}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary">Sonuç</Text>
                <div>
                  <Text>{record.reviewResult}</Text>
                </div>
              </div>
            </Space>
          </Col>
          <Col xs={24} sm={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">KYC seviye</Text>
                <div>
                  <Text>{record.kycLevel ?? '—'}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary">Oluşturulma</Text>
                <div>
                  <Text>
                    {new Date(record.createdAt).toLocaleString('tr-TR')}
                  </Text>
                </div>
              </div>
              <div>
                <Text type="secondary">Son güncelleme</Text>
                <div>
                  <Text>
                    {new Date(record.updatedAt).toLocaleString('tr-TR')}
                  </Text>
                </div>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card bordered title="İnceleme güncelle">
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div style={{ width: '100%' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              İnceleme durumu
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
              Sonuç
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
              Gerekçe
            </Text>
            <Input
              value={reviewReason}
              onChange={(e) => setReviewReason(e.target.value)}
              placeholder="İsteğe bağlı"
            />
          </div>

          <Button type="primary" onClick={handleSave} loading={saving}>
            Kaydet
          </Button>
        </Space>
      </Card>
    </div>
  );
}

export default UserKycDetail;
