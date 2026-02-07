import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import DataCard from '../../components/DataCard';
import Button from '../../components/Button';
import LoadingSpinner from '../../components/LoadingSpinner';
import { fetchUserKycByUserId, updateKycReview } from '../../api/admin-kyc';
import type { AdminKycDetailResponse } from '../../types/admin';
import './users.css';

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
  const [message, setMessage] = useState<string | null>(null);

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
        if (!cancelled) setError(e instanceof Error ? e.message : 'KYC kaydı yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleSave = async () => {
    if (!record) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateKycReview(record.id, {
        reviewStatus: reviewStatus || undefined,
        reviewResult: reviewResult || undefined,
        reviewReason: reviewReason || undefined,
      });
      const res = await fetchUserKycByUserId(userId!);
      if (res.data) setRecord(res.data);
      setMessage('KYC inceleme sonucu güncellendi');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Güncelleme başarısız');
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <div className="users-page">
        <p>Geçersiz kullanıcı</p>
      </div>
    );
  }

  if (loading || !record) {
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
        <Button variant="secondary" onClick={() => navigate('/users/kyc')}>
          Listeye dön
        </Button>
      </div>
    );
  }

  return (
    <div className="users-page">
      <PageHeader
        title={`KYC — ${record.userEmail ?? userId}`}
        description={`Kayıt: ${record.id.slice(0, 8)}…`}
        icon="fa-id-card"
        actions={
          <div className="users-detail-header-actions">
            <Button size="sm" variant="secondary" onClick={() => navigate('/users/kyc')}>
              Listeye dön
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/users/${userId}`)}>
              Kullanıcı detayı
            </Button>
          </div>
        }
      />

      {message && (
        <div className={`users-message users-message-success`}>{message}</div>
      )}

      <DataCard title="KYC bilgileri">
        <div className="users-detail-grid">
          <div className="users-detail-field">
            <div className="users-detail-field-label">Kullanıcı ID</div>
            <div className="users-detail-field-value">
              <a href={`/users/${record.userId}`} className="users-link">
                {record.userId}
              </a>
            </div>
          </div>
          <div className="users-detail-field">
            <div className="users-detail-field-label">Sumsub Applicant ID</div>
            <div className="users-detail-field-value">{record.sumsubApplicantId}</div>
          </div>
          <div className="users-detail-field">
            <div className="users-detail-field-label">İnceleme durumu</div>
            <div className="users-detail-field-value">{record.reviewStatus}</div>
          </div>
          <div className="users-detail-field">
            <div className="users-detail-field-label">Sonuç</div>
            <div className="users-detail-field-value">{record.reviewResult}</div>
          </div>
          <div className="users-detail-field">
            <div className="users-detail-field-label">KYC seviye</div>
            <div className="users-detail-field-value">{record.kycLevel ?? '—'}</div>
          </div>
          <div className="users-detail-field">
            <div className="users-detail-field-label">Oluşturulma</div>
            <div className="users-detail-field-value">{new Date(record.createdAt).toLocaleString('tr-TR')}</div>
          </div>
          <div className="users-detail-field">
            <div className="users-detail-field-label">Son güncelleme</div>
            <div className="users-detail-field-value">{new Date(record.updatedAt).toLocaleString('tr-TR')}</div>
          </div>
        </div>
      </DataCard>

      <DataCard title="İnceleme güncelle">
        <div className="users-form-group">
          <label>İnceleme durumu</label>
          <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
            <option value="INIT">INIT</option>
            <option value="PENDING">PENDING</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="DECLINED">DECLINED</option>
            <option value="ON_HOLD">ON_HOLD</option>
          </select>
        </div>
        <div className="users-form-group">
          <label>Sonuç</label>
          <select value={reviewResult} onChange={(e) => setReviewResult(e.target.value)}>
            <option value="NULL">NULL</option>
            <option value="GREEN">GREEN</option>
            <option value="YELLOW">YELLOW</option>
            <option value="RED">RED</option>
          </select>
        </div>
        <div className="users-form-group">
          <label>Gerekçe</label>
          <input
            type="text"
            value={reviewReason}
            onChange={(e) => setReviewReason(e.target.value)}
            placeholder="İsteğe bağlı"
          />
        </div>
        <div className="users-form-actions">
          <Button onClick={handleSave} disabled={saving}>
            Kaydet
          </Button>
        </div>
      </DataCard>
    </div>
  );
}

export default UserKycDetail;
