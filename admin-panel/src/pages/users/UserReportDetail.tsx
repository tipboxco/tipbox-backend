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
import { fetchUserReport, resolveUserReport } from '../../api/admin-reports';
import type { AdminUserReportDetailResponse } from '../../types/admin';

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
          setError(e instanceof Error ? e.message : 'Rapor yüklenemedi');
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
        resolved ? 'Rapor çözüldü olarak işaretlendi' : 'Rapor güncellendi'
      );
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setSaving(false);
    }
  };

  if (!id) {
    return (
      <div>
        <Alert message="Geçersiz rapor" type="error" />
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
          title="Hata"
          description={error}
          icon={<ExclamationCircleOutlined />}
        />
        <Button onClick={() => navigate('/users/reports')}>Listeye dön</Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Rapor #${report.id.slice(0, 8)}`}
        description={report.category}
        icon={<FlagOutlined />}
        backTo="/users/reports"
        backLabel="Listeye dön"
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card bordered title="Şikayet edilen kullanıcı">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">ID</Text>
                <div>
                  <Link to={`/users/${report.reportedUserId}`}>
                    <Button type="link" size="small" style={{ padding: 0 }}>
                      {report.reportedUserId}
                    </Button>
                  </Link>
                </div>
              </div>
              <div>
                <Text type="secondary">Görünen ad / Email</Text>
                <div>
                  <Text>
                    {report.reportedUserDisplayName ??
                      report.reportedUserEmail ??
                      '—'}
                  </Text>
                </div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card bordered title="Şikayet eden">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">ID</Text>
                <div>
                  <Link to={`/users/${report.reporterId}`}>
                    <Button type="link" size="small" style={{ padding: 0 }}>
                      {report.reporterId}
                    </Button>
                  </Link>
                </div>
              </div>
              <div>
                <Text type="secondary">Görünen ad / Email</Text>
                <div>
                  <Text>
                    {report.reporterDisplayName ??
                      report.reporterEmail ??
                      '—'}
                  </Text>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card bordered title="Açıklama" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Paragraph>{report.description ?? '—'}</Paragraph>
          <div>
            <Text type="secondary">Tarih</Text>
            <div>
              <Text>{new Date(report.createdAt).toLocaleString('tr-TR')}</Text>
            </div>
          </div>
          <div>
            <Text type="secondary">Durum</Text>
            <div>
              <Tag color={report.resolved ? 'success' : 'default'}>
                {report.resolved ? 'Çözüldü' : 'Bekliyor'}
              </Tag>
              {report.resolvedAt && (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  {new Date(report.resolvedAt).toLocaleString('tr-TR')}
                </Text>
              )}
            </div>
          </div>
        </Space>
      </Card>

      <Card bordered title="Çözümle">
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Checkbox
            checked={resolved}
            onChange={(e) => setResolved(e.target.checked)}
          >
            Çözüldü
          </Checkbox>

          <div style={{ width: '100%' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Admin notu
            </Text>
            <Input
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="İsteğe bağlı not"
            />
          </div>

          <Button
            type="primary"
            onClick={handleResolve}
            loading={saving}
          >
            Kaydet
          </Button>
        </Space>
      </Card>
    </div>
  );
}

export default UserReportDetail;
