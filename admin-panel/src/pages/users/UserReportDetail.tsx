import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fetchUserReport, resolveUserReport } from '../../api/admin-reports';
import type { AdminUserReportDetailResponse } from '../../types/admin';
import './users.css';

function UserReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<AdminUserReportDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        if (!cancelled) setError(e instanceof Error ? e.message : 'Rapor yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleResolve = async () => {
    if (!id) return;
    setSaving(true);
    setMessage(null);
    try {
      await resolveUserReport(id, { resolved, adminNote: adminNote || undefined });
      const res = await fetchUserReport(id);
      if (res.data) setReport(res.data);
      setMessage(resolved ? 'Rapor çözüldü olarak işaretlendi' : 'Rapor güncellendi');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setSaving(false);
    }
  };

  if (!id) {
    return (
      <div className="users-page">
        <p>Geçersiz rapor</p>
      </div>
    );
  }

  if (loading || !report) {
    return (
      <div className="users-page">
        <LoadingSpinner fullScreen={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="users-page">
        <PageHeader title="Hata" description={error} icon="fa-exclamation-triangle" />
        <Button variant="secondary" onClick={() => navigate('/users/reports')}>
          Listeye dön
        </Button>
      </div>
    );
  }

  return (
    <div className="users-page">
      <PageHeader
        title={`Rapor #${report.id.slice(0, 8)}`}
        description={report.category}
        icon="fa-flag"
        actions={
          <Button size="sm" variant="secondary" onClick={() => navigate('/users/reports')}>
            Listeye dön
          </Button>
        }
      />

      {message && (
        <div className={`users-message ${message.includes('başarısız') ? 'users-message-error' : 'users-message-success'}`}>
          {message}
        </div>
      )}

      <div className="users-detail-grid">
        <DataCard title="Şikayet edilen kullanıcı">
          <div className="users-detail-fields">
            <div className="users-detail-field">
              <div className="users-detail-field-label">ID</div>
              <div className="users-detail-field-value">
                <Link to={`/users/${report.reportedUserId}`} className="users-link">
                  {report.reportedUserId}
                </Link>
              </div>
            </div>
            <div className="users-detail-field">
              <div className="users-detail-field-label">Görünen ad / Email</div>
              <div className="users-detail-field-value">
                {report.reportedUserDisplayName ?? report.reportedUserEmail ?? '—'}
              </div>
            </div>
          </div>
        </DataCard>
        <DataCard title="Şikayet eden">
          <div className="users-detail-fields">
            <div className="users-detail-field">
              <div className="users-detail-field-label">ID</div>
              <div className="users-detail-field-value">
                <Link to={`/users/${report.reporterId}`} className="users-link">
                  {report.reporterId}
                </Link>
              </div>
            </div>
            <div className="users-detail-field">
              <div className="users-detail-field-label">Görünen ad / Email</div>
              <div className="users-detail-field-value">
                {report.reporterDisplayName ?? report.reporterEmail ?? '—'}
              </div>
            </div>
          </div>
        </DataCard>
      </div>

      <DataCard title="Açıklama" className="users-detail-panel">
        <p className="users-detail-field-value">{report.description ?? '—'}</p>
        <div className="users-detail-field">
          <div className="users-detail-field-label">Tarih</div>
          <div className="users-detail-field-value">{new Date(report.createdAt).toLocaleString('tr-TR')}</div>
        </div>
        <div className="users-detail-field">
          <div className="users-detail-field-label">Durum</div>
          <div className="users-detail-field-value">
            <span className={`users-badge ${report.resolved ? 'users-badge-success' : 'users-badge-neutral'}`}>
              {report.resolved ? 'Çözüldü' : 'Bekliyor'}
            </span>
            {report.resolvedAt && (
              <span className="users-detail-field-value" style={{ marginLeft: 8 }}>
                {new Date(report.resolvedAt).toLocaleString('tr-TR')}
              </span>
            )}
          </div>
        </div>
      </DataCard>

      <DataCard title="Çözümle">
        <div className="users-form-group">
          <label>
            <input type="checkbox" checked={resolved} onChange={(e) => setResolved(e.target.checked)} /> Çözüldü
          </label>
        </div>
        <div className="users-form-group">
          <label>Admin notu</label>
          <input
            type="text"
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="İsteğe bağlı not"
          />
        </div>
        <div className="users-form-actions">
          <Button onClick={handleResolve} disabled={saving}>
            Kaydet
          </Button>
        </div>
      </DataCard>
    </div>
  );
}

export default UserReportDetail;
